// src/post.ts
import {
  composeContext as composeContext2,
  generateText,
  getEmbeddingZeroVector as getEmbeddingZeroVector3,
  ModelClass as ModelClass2,
  stringToUuid as stringToUuid3,
  parseBooleanFromText
} from "@ai16z/eliza";
import { elizaLogger as elizaLogger3 } from "@ai16z/eliza";
import { postActionResponseFooter } from "@ai16z/eliza";
import { generateTweetActions } from "@ai16z/eliza";
import { ServiceType } from "@ai16z/eliza";

// src/utils.ts
import { getEmbeddingZeroVector } from "@ai16z/eliza";
import { stringToUuid } from "@ai16z/eliza";
import { elizaLogger } from "@ai16z/eliza";

// src/environment.ts
import { z } from "zod";
var DEFAULT_MAX_TWEET_LENGTH = 280;
var twitterEnvSchema = z.object({
  TWITTER_DRY_RUN: z.string().transform((val) => val.toLowerCase() === "true"),
  TWITTER_USERNAME: z.string().min(1, "Twitter username is required"),
  TWITTER_PASSWORD: z.string().min(1, "Twitter password is required"),
  TWITTER_EMAIL: z.string().email("Valid Twitter email is required"),
  TWITTER_COOKIES: z.string().optional(),
  MAX_TWEET_LENGTH: z.string().pipe(z.coerce.number().min(0).int()).default(DEFAULT_MAX_TWEET_LENGTH.toString())
});
async function validateTwitterConfig(runtime) {
  try {
    const config = {
      TWITTER_DRY_RUN: runtime.getSetting("TWITTER_DRY_RUN") || process.env.TWITTER_DRY_RUN || "false",
      TWITTER_USERNAME: runtime.getSetting("TWITTER_USERNAME") || process.env.TWITTER_USERNAME,
      TWITTER_PASSWORD: runtime.getSetting("TWITTER_PASSWORD") || process.env.TWITTER_PASSWORD,
      TWITTER_EMAIL: runtime.getSetting("TWITTER_EMAIL") || process.env.TWITTER_EMAIL,
      TWITTER_COOKIES: runtime.getSetting("TWITTER_COOKIES") || process.env.TWITTER_COOKIES,
      MAX_TWEET_LENGTH: runtime.getSetting("MAX_TWEET_LENGTH") || process.env.MAX_TWEET_LENGTH || DEFAULT_MAX_TWEET_LENGTH.toString()
    };
    return twitterEnvSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n");
      throw new Error(
        `Twitter configuration validation failed:
${errorMessages}`
      );
    }
    throw error;
  }
}

// src/utils.ts
var wait = (minTime = 1e3, maxTime = 3e3) => {
  const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};
async function buildConversationThread(tweet, client, maxReplies = 10) {
  const thread = [];
  const visited = /* @__PURE__ */ new Set();
  async function processThread(currentTweet, depth = 0) {
    elizaLogger.debug("Processing tweet:", {
      id: currentTweet.id,
      inReplyToStatusId: currentTweet.inReplyToStatusId,
      depth
    });
    if (!currentTweet) {
      elizaLogger.debug("No current tweet found for thread building");
      return;
    }
    if (depth >= maxReplies) {
      elizaLogger.debug("Reached maximum reply depth", depth);
      return;
    }
    const memory = await client.runtime.messageManager.getMemoryById(
      stringToUuid(currentTweet.id + "-" + client.runtime.agentId)
    );
    if (!memory) {
      const roomId = stringToUuid(
        currentTweet.conversationId + "-" + client.runtime.agentId
      );
      const userId = stringToUuid(currentTweet.userId);
      await client.runtime.ensureConnection(
        userId,
        roomId,
        currentTweet.username,
        currentTweet.name,
        "twitter"
      );
      await client.runtime.messageManager.createMemory({
        id: stringToUuid(
          currentTweet.id + "-" + client.runtime.agentId
        ),
        agentId: client.runtime.agentId,
        content: {
          text: currentTweet.text,
          source: "twitter",
          url: currentTweet.permanentUrl,
          inReplyTo: currentTweet.inReplyToStatusId ? stringToUuid(
            currentTweet.inReplyToStatusId + "-" + client.runtime.agentId
          ) : void 0
        },
        createdAt: currentTweet.timestamp * 1e3,
        roomId,
        userId: currentTweet.userId === client.profile.id ? client.runtime.agentId : stringToUuid(currentTweet.userId),
        embedding: getEmbeddingZeroVector()
      });
    }
    if (visited.has(currentTweet.id)) {
      elizaLogger.debug("Already visited tweet:", currentTweet.id);
      return;
    }
    visited.add(currentTweet.id);
    thread.unshift(currentTweet);
    elizaLogger.debug("Current thread state:", {
      length: thread.length,
      currentDepth: depth,
      tweetId: currentTweet.id
    });
    if (currentTweet.inReplyToStatusId) {
      elizaLogger.debug(
        "Fetching parent tweet:",
        currentTweet.inReplyToStatusId
      );
      try {
        const parentTweet = await client.twitterClient.getTweet(
          currentTweet.inReplyToStatusId
        );
        if (parentTweet) {
          elizaLogger.debug("Found parent tweet:", {
            id: parentTweet.id,
            text: parentTweet.text?.slice(0, 50)
          });
          await processThread(parentTweet, depth + 1);
        } else {
          elizaLogger.debug(
            "No parent tweet found for:",
            currentTweet.inReplyToStatusId
          );
        }
      } catch (error) {
        elizaLogger.error("Error fetching parent tweet:", {
          tweetId: currentTweet.inReplyToStatusId,
          error
        });
      }
    } else {
      elizaLogger.debug(
        "Reached end of reply chain at:",
        currentTweet.id
      );
    }
  }
  await processThread(tweet, 0);
  elizaLogger.debug("Final thread built:", {
    totalTweets: thread.length,
    tweetIds: thread.map((t) => ({
      id: t.id,
      text: t.text?.slice(0, 50)
    }))
  });
  return thread;
}
async function sendTweet(client, content, roomId, twitterUsername, inReplyTo) {
  const tweetChunks = splitTweetContent(
    content.text,
    Number(client.runtime.getSetting("MAX_TWEET_LENGTH")) || DEFAULT_MAX_TWEET_LENGTH
  );
  const sentTweets = [];
  let previousTweetId = inReplyTo;
  for (const chunk of tweetChunks) {
    const result = await client.requestQueue.add(
      async () => await client.twitterClient.sendTweet(
        chunk.trim(),
        previousTweetId
      )
    );
    const body = await result.json();
    if (body?.data?.create_tweet?.tweet_results?.result) {
      const tweetResult = body.data.create_tweet.tweet_results.result;
      const finalTweet = {
        id: tweetResult.rest_id,
        text: tweetResult.legacy.full_text,
        conversationId: tweetResult.legacy.conversation_id_str,
        timestamp: new Date(tweetResult.legacy.created_at).getTime() / 1e3,
        userId: tweetResult.legacy.user_id_str,
        inReplyToStatusId: tweetResult.legacy.in_reply_to_status_id_str,
        permanentUrl: `https://twitter.com/${twitterUsername}/status/${tweetResult.rest_id}`,
        hashtags: [],
        mentions: [],
        photos: [],
        thread: [],
        urls: [],
        videos: []
      };
      sentTweets.push(finalTweet);
      previousTweetId = finalTweet.id;
    } else {
      console.error("Error sending chunk", chunk, "repsonse:", body);
    }
    await wait(1e3, 2e3);
  }
  const memories = sentTweets.map((tweet) => ({
    id: stringToUuid(tweet.id + "-" + client.runtime.agentId),
    agentId: client.runtime.agentId,
    userId: client.runtime.agentId,
    content: {
      text: tweet.text,
      source: "twitter",
      url: tweet.permanentUrl,
      inReplyTo: tweet.inReplyToStatusId ? stringToUuid(
        tweet.inReplyToStatusId + "-" + client.runtime.agentId
      ) : void 0
    },
    roomId,
    embedding: getEmbeddingZeroVector(),
    createdAt: tweet.timestamp * 1e3
  }));
  return memories;
}
function splitTweetContent(content, maxLength) {
  const paragraphs = content.split("\n\n").map((p) => p.trim());
  const tweets = [];
  let currentTweet = "";
  for (const paragraph of paragraphs) {
    if (!paragraph) continue;
    if ((currentTweet + "\n\n" + paragraph).trim().length <= maxLength) {
      if (currentTweet) {
        currentTweet += "\n\n" + paragraph;
      } else {
        currentTweet = paragraph;
      }
    } else {
      if (currentTweet) {
        tweets.push(currentTweet.trim());
      }
      if (paragraph.length <= maxLength) {
        currentTweet = paragraph;
      } else {
        const chunks = splitParagraph(paragraph, maxLength);
        tweets.push(...chunks.slice(0, -1));
        currentTweet = chunks[chunks.length - 1];
      }
    }
  }
  if (currentTweet) {
    tweets.push(currentTweet.trim());
  }
  return tweets;
}
function splitParagraph(paragraph, maxLength) {
  const sentences = paragraph.match(/[^\.!\?]+[\.!\?]+|[^\.!\?]+$/g) || [
    paragraph
  ];
  const chunks = [];
  let currentChunk = "";
  for (const sentence of sentences) {
    if ((currentChunk + " " + sentence).trim().length <= maxLength) {
      if (currentChunk) {
        currentChunk += " " + sentence;
      } else {
        currentChunk = sentence;
      }
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      if (sentence.length <= maxLength) {
        currentChunk = sentence;
      } else {
        const words = sentence.split(" ");
        currentChunk = "";
        for (const word of words) {
          if ((currentChunk + " " + word).trim().length <= maxLength) {
            if (currentChunk) {
              currentChunk += " " + word;
            } else {
              currentChunk = word;
            }
          } else {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = word;
          }
        }
      }
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

// src/interactions.ts
import { SearchMode } from "agent-twitter-client";
import {
  composeContext,
  generateMessageResponse,
  generateShouldRespond,
  messageCompletionFooter,
  shouldRespondFooter,
  ModelClass,
  stringToUuid as stringToUuid2,
  elizaLogger as elizaLogger2,
  getEmbeddingZeroVector as getEmbeddingZeroVector2
} from "@ai16z/eliza";
var twitterMessageHandlerTemplate = `
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

{{recentPosts}}

# Task: Generate a post/reply in the voice, style and perspective of {{agentName}} (@{{twitterUserName}}) while using the thread of tweets as additional context:
Current Post:
{{currentPost}}

Thread of Tweets You Are Replying To:
{{formattedConversation}}

{{actions}}
# Task: Generate a post in the voice, style and perspective of {{agentName}} (@{{twitterUserName}}). You MUST include an action if the current post text includes a prompt that is similar to one of the available actions mentioned here:
{{actionNames}}
Here is the current post text again. Remember to include an action if the current post text includes a prompt that asks for one of the available actions mentioned above (does not need to be exact)
{{currentPost}}
` + messageCompletionFooter;
var twitterShouldRespondTemplate = (targetUsersStr) => `# INSTRUCTIONS: Determine if {{agentName}} (@{{twitterUserName}}) should respond to the message and participate in the conversation. Do not comment. Just respond with "true" or "false".

Response options are RESPOND, IGNORE and STOP.

PRIORITY RULE: ALWAYS RESPOND to these users regardless of topic or message content: ${targetUsersStr}. Topic relevance should be ignored for these users.

For other users:
- {{agentName}} should RESPOND to messages directed at them
- {{agentName}} should RESPOND to conversations relevant to their background
- {{agentName}} should IGNORE irrelevant messages
- {{agentName}} should IGNORE very short messages unless directly addressed
- {{agentName}} should STOP if asked to stop
- {{agentName}} should STOP if conversation is concluded
- {{agentName}} is in a room with other users and wants to be conversational, but not annoying.

{{recentPosts}}

IMPORTANT: For users not in the priority list, {{agentName}} (@{{twitterUserName}}) should err on the side of IGNORE rather than RESPOND if in doubt.

{{recentPosts}}

IMPORTANT: {{agentName}} (aka @{{twitterUserName}}) is particularly sensitive about being annoying, so if there is any doubt, it is better to IGNORE than to RESPOND.

{{currentPost}}

Thread of Tweets You Are Replying To:

{{formattedConversation}}

# INSTRUCTIONS: Respond with [RESPOND] if {{agentName}} should respond, or [IGNORE] if {{agentName}} should not respond to the last message and [STOP] if {{agentName}} should stop participating in the conversation.
` + shouldRespondFooter;
var TwitterInteractionClient = class {
  client;
  runtime;
  constructor(client, runtime) {
    this.client = client;
    this.runtime = runtime;
  }
  async start() {
    const handleTwitterInteractionsLoop = () => {
      this.handleTwitterInteractions();
      setTimeout(
        handleTwitterInteractionsLoop,
        Number(
          this.runtime.getSetting("TWITTER_POLL_INTERVAL") || 120
        ) * 1e3
        // Default to 2 minutes
      );
    };
    handleTwitterInteractionsLoop();
  }
  async handleTwitterInteractions() {
    elizaLogger2.log("Checking Twitter interactions");
    const targetUsersStr = this.runtime.getSetting("TWITTER_TARGET_USERS");
    const twitterUsername = this.client.profile.username;
    try {
      const mentionCandidates = (await this.client.fetchSearchTweets(
        `@${twitterUsername}`,
        20,
        SearchMode.Latest
      )).tweets;
      elizaLogger2.log("Completed checking mentioned tweets:", mentionCandidates.length);
      let uniqueTweetCandidates = [...mentionCandidates];
      if (targetUsersStr && targetUsersStr.trim()) {
        const TARGET_USERS = targetUsersStr.split(",").map((u) => u.trim()).filter((u) => u.length > 0);
        elizaLogger2.log("Processing target users:", TARGET_USERS);
        if (TARGET_USERS.length > 0) {
          const tweetsByUser = /* @__PURE__ */ new Map();
          for (const username of TARGET_USERS) {
            try {
              const userTweets = (await this.client.twitterClient.fetchSearchTweets(
                `from:${username}`,
                3,
                SearchMode.Latest
              )).tweets;
              const validTweets = userTweets.filter((tweet) => {
                const isUnprocessed = !this.client.lastCheckedTweetId || parseInt(tweet.id) > this.client.lastCheckedTweetId;
                const isRecent = Date.now() - tweet.timestamp * 1e3 < 2 * 60 * 60 * 1e3;
                elizaLogger2.log(`Tweet ${tweet.id} checks:`, {
                  isUnprocessed,
                  isRecent,
                  isReply: tweet.isReply,
                  isRetweet: tweet.isRetweet
                });
                return isUnprocessed && !tweet.isReply && !tweet.isRetweet && isRecent;
              });
              if (validTweets.length > 0) {
                tweetsByUser.set(username, validTweets);
                elizaLogger2.log(`Found ${validTweets.length} valid tweets from ${username}`);
              }
            } catch (error) {
              elizaLogger2.error(`Error fetching tweets for ${username}:`, error);
              continue;
            }
          }
          const selectedTweets = [];
          for (const [username, tweets] of tweetsByUser) {
            if (tweets.length > 0) {
              const randomTweet = tweets[Math.floor(Math.random() * tweets.length)];
              selectedTweets.push(randomTweet);
              elizaLogger2.log(`Selected tweet from ${username}: ${randomTweet.text?.substring(0, 100)}`);
            }
          }
          uniqueTweetCandidates = [...mentionCandidates, ...selectedTweets];
        }
      } else {
        elizaLogger2.log("No target users configured, processing only mentions");
      }
      uniqueTweetCandidates.sort((a, b) => a.id.localeCompare(b.id)).filter((tweet) => tweet.userId !== this.client.profile.id);
      for (const tweet of uniqueTweetCandidates) {
        if (!this.client.lastCheckedTweetId || BigInt(tweet.id) > this.client.lastCheckedTweetId) {
          const tweetId = stringToUuid2(
            tweet.id + "-" + this.runtime.agentId
          );
          const existingResponse = await this.runtime.messageManager.getMemoryById(
            tweetId
          );
          if (existingResponse) {
            elizaLogger2.log(
              `Already responded to tweet ${tweet.id}, skipping`
            );
            continue;
          }
          elizaLogger2.log("New Tweet found", tweet.permanentUrl);
          const roomId = stringToUuid2(
            tweet.conversationId + "-" + this.runtime.agentId
          );
          const userIdUUID = tweet.userId === this.client.profile.id ? this.runtime.agentId : stringToUuid2(tweet.userId);
          await this.runtime.ensureConnection(
            userIdUUID,
            roomId,
            tweet.username,
            tweet.name,
            "twitter"
          );
          const thread = await buildConversationThread(
            tweet,
            this.client
          );
          const message = {
            content: { text: tweet.text },
            agentId: this.runtime.agentId,
            userId: userIdUUID,
            roomId
          };
          await this.handleTweet({
            tweet,
            message,
            thread
          });
          this.client.lastCheckedTweetId = BigInt(tweet.id);
        }
      }
      await this.client.cacheLatestCheckedTweetId();
      elizaLogger2.log("Finished checking Twitter interactions");
    } catch (error) {
      elizaLogger2.error("Error handling Twitter interactions:", error);
    }
  }
  async handleTweet({
    tweet,
    message,
    thread
  }) {
    if (tweet.userId === this.client.profile.id) {
      return;
    }
    if (!message.content.text) {
      elizaLogger2.log("Skipping Tweet with no text", tweet.id);
      return { text: "", action: "IGNORE" };
    }
    elizaLogger2.log("Processing Tweet: ", tweet.id);
    const formatTweet = (tweet2) => {
      return `  ID: ${tweet2.id}
  From: ${tweet2.name} (@${tweet2.username})
  Text: ${tweet2.text}`;
    };
    const currentPost = formatTweet(tweet);
    elizaLogger2.debug("Thread: ", thread);
    const formattedConversation = thread.map(
      (tweet2) => `@${tweet2.username} (${new Date(
        tweet2.timestamp * 1e3
      ).toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric"
      })}):
        ${tweet2.text}`
    ).join("\n\n");
    elizaLogger2.debug("formattedConversation: ", formattedConversation);
    let state = await this.runtime.composeState(message, {
      twitterClient: this.client.twitterClient,
      twitterUserName: this.runtime.getSetting("TWITTER_USERNAME"),
      currentPost,
      formattedConversation
    });
    const tweetId = stringToUuid2(tweet.id + "-" + this.runtime.agentId);
    const tweetExists = await this.runtime.messageManager.getMemoryById(tweetId);
    if (!tweetExists) {
      elizaLogger2.log("tweet does not exist, saving");
      const userIdUUID = stringToUuid2(tweet.userId);
      const roomId = stringToUuid2(tweet.conversationId);
      const message2 = {
        id: tweetId,
        agentId: this.runtime.agentId,
        content: {
          text: tweet.text,
          url: tweet.permanentUrl,
          inReplyTo: tweet.inReplyToStatusId ? stringToUuid2(
            tweet.inReplyToStatusId + "-" + this.runtime.agentId
          ) : void 0
        },
        userId: userIdUUID,
        roomId,
        createdAt: tweet.timestamp * 1e3
      };
      this.client.saveRequestMessage(message2, state);
    }
    const targetUsersStr = this.runtime.getSetting("TWITTER_TARGET_USERS");
    const validTargetUsersStr = targetUsersStr && targetUsersStr.trim() ? targetUsersStr.split(",").map((u) => u.trim()).filter((u) => u.length > 0).join(",") : "";
    const shouldRespondContext = composeContext({
      state,
      template: this.runtime.character.templates?.twitterShouldRespondTemplate?.(validTargetUsersStr) || this.runtime.character?.templates?.shouldRespondTemplate || twitterShouldRespondTemplate(validTargetUsersStr)
    });
    const shouldRespond = await generateShouldRespond({
      runtime: this.runtime,
      context: shouldRespondContext,
      modelClass: ModelClass.MEDIUM
    });
    if (shouldRespond !== "RESPOND") {
      elizaLogger2.log("Not responding to message");
      return { text: "Response Decision:", action: shouldRespond };
    }
    const context = composeContext({
      state,
      template: this.runtime.character.templates?.twitterMessageHandlerTemplate || this.runtime.character?.templates?.messageHandlerTemplate || twitterMessageHandlerTemplate
    });
    elizaLogger2.debug("Interactions prompt:\n" + context);
    const response = await generateMessageResponse({
      runtime: this.runtime,
      context,
      modelClass: ModelClass.MEDIUM
    });
    const removeQuotes = (str) => str.replace(/^['"](.*)['"]$/, "$1");
    const stringId = stringToUuid2(tweet.id + "-" + this.runtime.agentId);
    response.inReplyTo = stringId;
    response.text = removeQuotes(response.text);
    if (response.text) {
      try {
        const callback = async (response2) => {
          const memories = await sendTweet(
            this.client,
            response2,
            message.roomId,
            this.runtime.getSetting("TWITTER_USERNAME"),
            tweet.id
          );
          return memories;
        };
        const responseMessages = await callback(response);
        state = await this.runtime.updateRecentMessageState(
          state
        );
        for (const responseMessage of responseMessages) {
          if (responseMessage === responseMessages[responseMessages.length - 1]) {
            responseMessage.content.action = response.action;
          } else {
            responseMessage.content.action = "CONTINUE";
          }
          await this.runtime.messageManager.createMemory(
            responseMessage
          );
        }
        await this.runtime.processActions(
          message,
          responseMessages,
          state
        );
        const responseInfo = `Context:

${context}

Selected Post: ${tweet.id} - ${tweet.username}: ${tweet.text}
Agent's Output:
${response.text}`;
        await this.runtime.cacheManager.set(
          `twitter/tweet_generation_${tweet.id}.txt`,
          responseInfo
        );
        await wait();
      } catch (error) {
        elizaLogger2.error(`Error sending response tweet: ${error}`);
      }
    }
  }
  async buildConversationThread(tweet, maxReplies = 10) {
    const thread = [];
    const visited = /* @__PURE__ */ new Set();
    async function processThread(currentTweet, depth = 0) {
      elizaLogger2.log("Processing tweet:", {
        id: currentTweet.id,
        inReplyToStatusId: currentTweet.inReplyToStatusId,
        depth
      });
      if (!currentTweet) {
        elizaLogger2.log("No current tweet found for thread building");
        return;
      }
      if (depth >= maxReplies) {
        elizaLogger2.log("Reached maximum reply depth", depth);
        return;
      }
      const memory = await this.runtime.messageManager.getMemoryById(
        stringToUuid2(currentTweet.id + "-" + this.runtime.agentId)
      );
      if (!memory) {
        const roomId = stringToUuid2(
          currentTweet.conversationId + "-" + this.runtime.agentId
        );
        const userId = stringToUuid2(currentTweet.userId);
        await this.runtime.ensureConnection(
          userId,
          roomId,
          currentTweet.username,
          currentTweet.name,
          "twitter"
        );
        this.runtime.messageManager.createMemory({
          id: stringToUuid2(
            currentTweet.id + "-" + this.runtime.agentId
          ),
          agentId: this.runtime.agentId,
          content: {
            text: currentTweet.text,
            source: "twitter",
            url: currentTweet.permanentUrl,
            inReplyTo: currentTweet.inReplyToStatusId ? stringToUuid2(
              currentTweet.inReplyToStatusId + "-" + this.runtime.agentId
            ) : void 0
          },
          createdAt: currentTweet.timestamp * 1e3,
          roomId,
          userId: currentTweet.userId === this.twitterUserId ? this.runtime.agentId : stringToUuid2(currentTweet.userId),
          embedding: getEmbeddingZeroVector2()
        });
      }
      if (visited.has(currentTweet.id)) {
        elizaLogger2.log("Already visited tweet:", currentTweet.id);
        return;
      }
      visited.add(currentTweet.id);
      thread.unshift(currentTweet);
      elizaLogger2.debug("Current thread state:", {
        length: thread.length,
        currentDepth: depth,
        tweetId: currentTweet.id
      });
      if (currentTweet.inReplyToStatusId) {
        elizaLogger2.log(
          "Fetching parent tweet:",
          currentTweet.inReplyToStatusId
        );
        try {
          const parentTweet = await this.twitterClient.getTweet(
            currentTweet.inReplyToStatusId
          );
          if (parentTweet) {
            elizaLogger2.log("Found parent tweet:", {
              id: parentTweet.id,
              text: parentTweet.text?.slice(0, 50)
            });
            await processThread(parentTweet, depth + 1);
          } else {
            elizaLogger2.log(
              "No parent tweet found for:",
              currentTweet.inReplyToStatusId
            );
          }
        } catch (error) {
          elizaLogger2.log("Error fetching parent tweet:", {
            tweetId: currentTweet.inReplyToStatusId,
            error
          });
        }
      } else {
        elizaLogger2.log(
          "Reached end of reply chain at:",
          currentTweet.id
        );
      }
    }
    await processThread.bind(this)(tweet, 0);
    elizaLogger2.debug("Final thread built:", {
      totalTweets: thread.length,
      tweetIds: thread.map((t) => ({
        id: t.id,
        text: t.text?.slice(0, 50)
      }))
    });
    return thread;
  }
};

// src/post.ts
var twitterPostTemplate = `
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

# Task: Generate a post in the voice and style and perspective of {{agentName}} @{{twitterUserName}}.
Write a 1-3 sentence post that is {{adjective}} about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}. Do not add commentary or acknowledge this request, just write the post.
Your response should not contain any questions. Brief, concise statements only. The total character count MUST be less than {{maxTweetLength}}. No emojis. Use \\n\\n (double spaces) between statements.`;
var twitterActionTemplate = `
# INSTRUCTIONS: Determine actions for {{agentName}} (@{{twitterUserName}}) based on:
{{bio}}
{{postDirections}}

Guidelines:
- Highly selective engagement
- Direct mentions are priority
- Skip: low-effort content, off-topic, repetitive

Actions (respond only with tags):
[LIKE] - Resonates with interests (9.5/10)
[RETWEET] - Perfect character alignment (9/10)
[QUOTE] - Can add unique value (8/10)
[REPLY] - Memetic opportunity (9/10)

Tweet:
{{currentTweet}}

# Respond with qualifying action tags only.` + postActionResponseFooter;
var MAX_TWEET_LENGTH = 240;
function truncateToCompleteSentence(text, maxTweetLength) {
  if (text.length <= maxTweetLength) {
    return text;
  }
  const truncatedAtPeriod = text.slice(
    0,
    text.lastIndexOf(".", maxTweetLength) + 1
  );
  if (truncatedAtPeriod.trim().length > 0) {
    return truncatedAtPeriod.trim();
  }
  const truncatedAtSpace = text.slice(
    0,
    text.lastIndexOf(" ", maxTweetLength)
  );
  if (truncatedAtSpace.trim().length > 0) {
    return truncatedAtSpace.trim() + "...";
  }
  return text.slice(0, maxTweetLength - 3).trim() + "...";
}
var TwitterPostClient = class {
  client;
  runtime;
  isProcessing = false;
  lastProcessTime = 0;
  stopProcessingActions = false;
  async start(postImmediately = false) {
    if (!this.client.profile) {
      await this.client.init();
    }
    const generateNewTweetLoop = async () => {
      const lastPost = await this.runtime.cacheManager.get(
        "twitter/" + this.runtime.getSetting("TWITTER_USERNAME") + "/lastPost"
      );
      const lastPostTimestamp = lastPost?.timestamp ?? 0;
      const minMinutes = parseInt(this.runtime.getSetting("POST_INTERVAL_MIN")) || 90;
      const maxMinutes = parseInt(this.runtime.getSetting("POST_INTERVAL_MAX")) || 180;
      const randomMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
      const delay = randomMinutes * 60 * 1e3;
      if (Date.now() > lastPostTimestamp + delay) {
        await this.generateNewTweet();
      }
      setTimeout(() => {
        generateNewTweetLoop();
      }, delay);
      elizaLogger3.log(`Next tweet scheduled in ${randomMinutes} minutes`);
    };
    const processActionsLoop = async () => {
      const actionInterval = parseInt(
        this.runtime.getSetting("ACTION_INTERVAL")
      ) || 3e5;
      while (!this.stopProcessingActions) {
        try {
          const results = await this.processTweetActions();
          if (results) {
            elizaLogger3.log(`Processed ${results.length} tweets`);
            elizaLogger3.log(`Next action processing scheduled in ${actionInterval / 1e3} seconds`);
            await new Promise((resolve) => setTimeout(resolve, actionInterval));
          }
        } catch (error) {
          elizaLogger3.error("Error in action processing loop:", error);
          await new Promise((resolve) => setTimeout(resolve, 3e4));
        }
      }
    };
    if (this.runtime.getSetting("POST_IMMEDIATELY") != null && this.runtime.getSetting("POST_IMMEDIATELY") != "") {
      postImmediately = parseBooleanFromText(
        this.runtime.getSetting("POST_IMMEDIATELY")
      );
    }
    if (postImmediately) {
      await this.generateNewTweet();
    }
    generateNewTweetLoop();
    const enableActionProcessing = parseBooleanFromText(
      this.runtime.getSetting("ENABLE_ACTION_PROCESSING") ?? "true"
    );
    if (enableActionProcessing) {
      processActionsLoop().catch((error) => {
        elizaLogger3.error("Fatal error in process actions loop:", error);
      });
    } else {
      elizaLogger3.log("Action processing loop disabled by configuration");
    }
  }
  constructor(client, runtime) {
    this.client = client;
    this.runtime = runtime;
  }
  async generateNewTweet() {
    elizaLogger3.log("Generating new tweet");
    try {
      const roomId = stringToUuid3(
        "twitter_generate_room-" + this.client.profile.username
      );
      await this.runtime.ensureUserExists(
        this.runtime.agentId,
        this.client.profile.username,
        this.runtime.character.name,
        "twitter"
      );
      const topics = this.runtime.character.topics.join(", ");
      const state = await this.runtime.composeState(
        {
          userId: this.runtime.agentId,
          roomId,
          agentId: this.runtime.agentId,
          content: {
            text: topics || "",
            action: "TWEET"
          }
        },
        {
          twitterUserName: this.client.profile.username
        }
      );
      const context = composeContext2({
        state,
        template: this.runtime.character.templates?.twitterPostTemplate || twitterPostTemplate
      });
      elizaLogger3.debug("generate post prompt:\n" + context);
      const newTweetContent = await generateText({
        runtime: this.runtime,
        context,
        modelClass: ModelClass2.SMALL
      });
      let cleanedContent = "";
      try {
        const parsedResponse = JSON.parse(newTweetContent);
        if (parsedResponse.text) {
          cleanedContent = parsedResponse.text;
        } else if (typeof parsedResponse === "string") {
          cleanedContent = parsedResponse;
        }
      } catch (error) {
        error.linted = true;
        cleanedContent = newTweetContent.replace(/^\s*{?\s*"text":\s*"|"\s*}?\s*$/g, "").replace(/^['"](.*)['"]$/g, "$1").replace(/\\"/g, '"').trim();
      }
      if (!cleanedContent) {
        elizaLogger3.error("Failed to extract valid content from response:", {
          rawResponse: newTweetContent,
          attempted: "JSON parsing"
        });
        return;
      }
      const content = truncateToCompleteSentence(cleanedContent, MAX_TWEET_LENGTH);
      const removeQuotes = (str) => str.replace(/^['"](.*)['"]$/, "$1");
      cleanedContent = removeQuotes(content);
      if (this.runtime.getSetting("TWITTER_DRY_RUN") === "true") {
        elizaLogger3.info(
          `Dry run: would have posted tweet: ${cleanedContent}`
        );
        return;
      }
      try {
        elizaLogger3.log(`Posting new tweet:
 ${cleanedContent}`);
        const result = await this.client.requestQueue.add(
          async () => await this.client.twitterClient.sendTweet(cleanedContent)
        );
        const body = await result.json();
        if (!body?.data?.create_tweet?.tweet_results?.result) {
          console.error("Error sending tweet; Bad response:", body);
          return;
        }
        const tweetResult = body.data.create_tweet.tweet_results.result;
        const tweet = {
          id: tweetResult.rest_id,
          name: this.client.profile.screenName,
          username: this.client.profile.username,
          text: tweetResult.legacy.full_text,
          conversationId: tweetResult.legacy.conversation_id_str,
          createdAt: tweetResult.legacy.created_at,
          timestamp: new Date(
            tweetResult.legacy.created_at
          ).getTime(),
          userId: this.client.profile.id,
          inReplyToStatusId: tweetResult.legacy.in_reply_to_status_id_str,
          permanentUrl: `https://twitter.com/${this.runtime.getSetting("TWITTER_USERNAME")}/status/${tweetResult.rest_id}`,
          hashtags: [],
          mentions: [],
          photos: [],
          thread: [],
          urls: [],
          videos: []
        };
        await this.runtime.cacheManager.set(
          `twitter/${this.client.profile.username}/lastPost`,
          {
            id: tweet.id,
            timestamp: Date.now()
          }
        );
        await this.client.cacheTweet(tweet);
        elizaLogger3.log(`Tweet posted:
 ${tweet.permanentUrl}`);
        await this.runtime.ensureRoomExists(roomId);
        await this.runtime.ensureParticipantInRoom(
          this.runtime.agentId,
          roomId
        );
        await this.runtime.messageManager.createMemory({
          id: stringToUuid3(tweet.id + "-" + this.runtime.agentId),
          userId: this.runtime.agentId,
          agentId: this.runtime.agentId,
          content: {
            text: newTweetContent.trim(),
            url: tweet.permanentUrl,
            source: "twitter"
          },
          roomId,
          embedding: getEmbeddingZeroVector3(),
          createdAt: tweet.timestamp
        });
      } catch (error) {
        elizaLogger3.error("Error sending tweet:", error);
      }
    } catch (error) {
      elizaLogger3.error("Error generating new tweet:", error);
    }
  }
  async generateTweetContent(tweetState, options) {
    const context = composeContext2({
      state: tweetState,
      template: options?.template || this.runtime.character.templates?.twitterPostTemplate || twitterPostTemplate
    });
    const response = await generateText({
      runtime: this.runtime,
      context: options?.context || context,
      modelClass: ModelClass2.SMALL
    });
    console.log("generate tweet content response:\n" + response);
    const cleanedResponse = response.replace(/```json\s*/g, "").replace(/```\s*/g, "").replaceAll(/\\n/g, "\n").trim();
    try {
      const jsonResponse = JSON.parse(cleanedResponse);
      if (jsonResponse.text) {
        return this.trimTweetLength(jsonResponse.text);
      }
      if (typeof jsonResponse === "object") {
        const possibleContent = jsonResponse.content || jsonResponse.message || jsonResponse.response;
        if (possibleContent) {
          return this.trimTweetLength(possibleContent);
        }
      }
    } catch (error) {
      error.linted = true;
      elizaLogger3.debug("Response is not JSON, treating as plain text");
    }
    return this.trimTweetLength(cleanedResponse);
  }
  // Helper method to ensure tweet length compliance
  trimTweetLength(text, maxLength = 280) {
    if (text.length <= maxLength) return text;
    const lastSentence = text.slice(0, maxLength).lastIndexOf(".");
    if (lastSentence > 0) {
      return text.slice(0, lastSentence + 1).trim();
    }
    return text.slice(0, text.lastIndexOf(" ", maxLength - 3)).trim() + "...";
  }
  async processTweetActions() {
    if (this.isProcessing) {
      elizaLogger3.log("Already processing tweet actions, skipping");
      return null;
    }
    try {
      this.isProcessing = true;
      this.lastProcessTime = Date.now();
      elizaLogger3.log("Processing tweet actions");
      await this.runtime.ensureUserExists(
        this.runtime.agentId,
        this.runtime.getSetting("TWITTER_USERNAME"),
        this.runtime.character.name,
        "twitter"
      );
      const homeTimeline = await this.client.fetchTimelineForActions(15);
      const results = [];
      for (const tweet of homeTimeline) {
        try {
          const memory = await this.runtime.messageManager.getMemoryById(
            stringToUuid3(tweet.id + "-" + this.runtime.agentId)
          );
          if (memory) {
            elizaLogger3.log(`Already processed tweet ID: ${tweet.id}`);
            continue;
          }
          const roomId = stringToUuid3(
            tweet.conversationId + "-" + this.runtime.agentId
          );
          const tweetState = await this.runtime.composeState(
            {
              userId: this.runtime.agentId,
              roomId,
              agentId: this.runtime.agentId,
              content: { text: "", action: "" }
            },
            {
              twitterUserName: this.runtime.getSetting("TWITTER_USERNAME"),
              currentTweet: `ID: ${tweet.id}
From: ${tweet.name} (@${tweet.username})
Text: ${tweet.text}`
            }
          );
          const actionContext = composeContext2({
            state: tweetState,
            template: this.runtime.character.templates?.twitterActionTemplate || twitterActionTemplate
          });
          const actionResponse = await generateTweetActions({
            runtime: this.runtime,
            context: actionContext,
            modelClass: ModelClass2.SMALL
          });
          if (!actionResponse) {
            elizaLogger3.log(`No valid actions generated for tweet ${tweet.id}`);
            continue;
          }
          const executedActions = [];
          if (actionResponse.like) {
            try {
              await this.client.twitterClient.likeTweet(tweet.id);
              executedActions.push("like");
              elizaLogger3.log(`Liked tweet ${tweet.id}`);
            } catch (error) {
              elizaLogger3.error(`Error liking tweet ${tweet.id}:`, error);
            }
          }
          if (actionResponse.retweet) {
            try {
              await this.client.twitterClient.retweet(tweet.id);
              executedActions.push("retweet");
              elizaLogger3.log(`Retweeted tweet ${tweet.id}`);
            } catch (error) {
              elizaLogger3.error(`Error retweeting tweet ${tweet.id}:`, error);
            }
          }
          if (actionResponse.quote) {
            try {
              const thread = await buildConversationThread(tweet, this.client);
              const formattedConversation = thread.map((t) => `@${t.username} (${new Date(t.timestamp * 1e3).toLocaleString()}): ${t.text}`).join("\n\n");
              const imageDescriptions = [];
              if (tweet.photos?.length > 0) {
                elizaLogger3.log("Processing images in tweet for context");
                for (const photo of tweet.photos) {
                  const description = await this.runtime.getService(ServiceType.IMAGE_DESCRIPTION).describeImage(photo.url);
                  imageDescriptions.push(description);
                }
              }
              let quotedContent = "";
              if (tweet.quotedStatusId) {
                try {
                  const quotedTweet = await this.client.twitterClient.getTweet(tweet.quotedStatusId);
                  if (quotedTweet) {
                    quotedContent = `
Quoted Tweet from @${quotedTweet.username}:
${quotedTweet.text}`;
                  }
                } catch (error) {
                  elizaLogger3.error("Error fetching quoted tweet:", error);
                }
              }
              const enrichedState = await this.runtime.composeState(
                {
                  userId: this.runtime.agentId,
                  roomId: stringToUuid3(tweet.conversationId + "-" + this.runtime.agentId),
                  agentId: this.runtime.agentId,
                  content: { text: tweet.text, action: "QUOTE" }
                },
                {
                  twitterUserName: this.runtime.getSetting("TWITTER_USERNAME"),
                  currentPost: `From @${tweet.username}: ${tweet.text}`,
                  formattedConversation,
                  imageContext: imageDescriptions.length > 0 ? `
Images in Tweet:
${imageDescriptions.map((desc, i) => `Image ${i + 1}: ${desc}`).join("\n")}` : "",
                  quotedContent
                }
              );
              const quoteContent = await this.generateTweetContent(enrichedState, {
                template: this.runtime.character.templates?.twitterMessageHandlerTemplate || twitterMessageHandlerTemplate
              });
              if (!quoteContent) {
                elizaLogger3.error("Failed to generate valid quote tweet content");
                return;
              }
              elizaLogger3.log("Generated quote tweet content:", quoteContent);
              const result = await this.client.requestQueue.add(
                async () => await this.client.twitterClient.sendQuoteTweet(
                  quoteContent,
                  tweet.id
                )
              );
              const body = await result.json();
              if (body?.data?.create_tweet?.tweet_results?.result) {
                elizaLogger3.log("Successfully posted quote tweet");
                executedActions.push("quote");
                await this.runtime.cacheManager.set(
                  `twitter/quote_generation_${tweet.id}.txt`,
                  `Context:
${enrichedState}

Generated Quote:
${quoteContent}`
                );
              } else {
                elizaLogger3.error("Quote tweet creation failed:", body);
              }
            } catch (error) {
              elizaLogger3.error("Error in quote tweet generation:", error);
            }
          }
          if (actionResponse.reply) {
            try {
              await this.handleTextOnlyReply(tweet, tweetState, executedActions);
            } catch (error) {
              elizaLogger3.error(`Error replying to tweet ${tweet.id}:`, error);
            }
          }
          await this.runtime.ensureRoomExists(roomId);
          await this.runtime.ensureUserExists(
            stringToUuid3(tweet.userId),
            tweet.username,
            tweet.name,
            "twitter"
          );
          await this.runtime.ensureParticipantInRoom(
            this.runtime.agentId,
            roomId
          );
          await this.runtime.messageManager.createMemory({
            id: stringToUuid3(tweet.id + "-" + this.runtime.agentId),
            userId: stringToUuid3(tweet.userId),
            content: {
              text: tweet.text,
              url: tweet.permanentUrl,
              source: "twitter",
              action: executedActions.join(",")
            },
            agentId: this.runtime.agentId,
            roomId,
            embedding: getEmbeddingZeroVector3(),
            createdAt: tweet.timestamp * 1e3
          });
          results.push({
            tweetId: tweet.id,
            parsedActions: actionResponse,
            executedActions
          });
        } catch (error) {
          elizaLogger3.error(`Error processing tweet ${tweet.id}:`, error);
          continue;
        }
      }
      return results;
    } catch (error) {
      elizaLogger3.error("Error in processTweetActions:", error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }
  async handleTextOnlyReply(tweet, tweetState, executedActions) {
    try {
      const thread = await buildConversationThread(tweet, this.client);
      const formattedConversation = thread.map((t) => `@${t.username} (${new Date(t.timestamp * 1e3).toLocaleString()}): ${t.text}`).join("\n\n");
      const imageDescriptions = [];
      if (tweet.photos?.length > 0) {
        elizaLogger3.log("Processing images in tweet for context");
        for (const photo of tweet.photos) {
          const description = await this.runtime.getService(ServiceType.IMAGE_DESCRIPTION).describeImage(photo.url);
          imageDescriptions.push(description);
        }
      }
      let quotedContent = "";
      if (tweet.quotedStatusId) {
        try {
          const quotedTweet = await this.client.twitterClient.getTweet(tweet.quotedStatusId);
          if (quotedTweet) {
            quotedContent = `
Quoted Tweet from @${quotedTweet.username}:
${quotedTweet.text}`;
          }
        } catch (error) {
          elizaLogger3.error("Error fetching quoted tweet:", error);
        }
      }
      const enrichedState = await this.runtime.composeState(
        {
          userId: this.runtime.agentId,
          roomId: stringToUuid3(tweet.conversationId + "-" + this.runtime.agentId),
          agentId: this.runtime.agentId,
          content: { text: tweet.text, action: "" }
        },
        {
          twitterUserName: this.runtime.getSetting("TWITTER_USERNAME"),
          currentPost: `From @${tweet.username}: ${tweet.text}`,
          formattedConversation,
          imageContext: imageDescriptions.length > 0 ? `
Images in Tweet:
${imageDescriptions.map((desc, i) => `Image ${i + 1}: ${desc}`).join("\n")}` : "",
          quotedContent
        }
      );
      const replyText = await this.generateTweetContent(enrichedState, {
        template: this.runtime.character.templates?.twitterMessageHandlerTemplate || twitterMessageHandlerTemplate
      });
      if (!replyText) {
        elizaLogger3.error("Failed to generate valid reply content");
        return;
      }
      elizaLogger3.debug("Final reply text to be sent:", replyText);
      const result = await this.client.requestQueue.add(
        async () => await this.client.twitterClient.sendTweet(
          replyText,
          tweet.id
        )
      );
      const body = await result.json();
      if (body?.data?.create_tweet?.tweet_results?.result) {
        elizaLogger3.log("Successfully posted reply tweet");
        executedActions.push("reply");
        await this.runtime.cacheManager.set(
          `twitter/reply_generation_${tweet.id}.txt`,
          `Context:
${enrichedState}

Generated Reply:
${replyText}`
        );
      } else {
        elizaLogger3.error("Tweet reply creation failed:", body);
      }
    } catch (error) {
      elizaLogger3.error("Error in handleTextOnlyReply:", error);
    }
  }
  async stop() {
    this.stopProcessingActions = true;
  }
};

// src/search.ts
import { SearchMode as SearchMode2 } from "agent-twitter-client";
import { composeContext as composeContext3 } from "@ai16z/eliza";
import { generateMessageResponse as generateMessageResponse2, generateText as generateText2 } from "@ai16z/eliza";
import { messageCompletionFooter as messageCompletionFooter2 } from "@ai16z/eliza";
import {
  ModelClass as ModelClass3,
  ServiceType as ServiceType2
} from "@ai16z/eliza";
import { stringToUuid as stringToUuid4 } from "@ai16z/eliza";
var twitterSearchTemplate = `{{timeline}}

{{providers}}

Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{postDirections}}

{{recentPosts}}

# Task: Respond to the following post in the style and perspective of {{agentName}} (aka @{{twitterUserName}}). Write a {{adjective}} response for {{agentName}} to say directly in response to the post. don't generalize.
{{currentPost}}

IMPORTANT: Your response CANNOT be longer than 20 words.
Aim for 1-2 short sentences maximum. Be concise and direct.

Your response should not contain any questions. Brief, concise statements only. No emojis. Use \\n\\n (double spaces) between statements.

` + messageCompletionFooter2;
var TwitterSearchClient = class {
  client;
  runtime;
  respondedTweets = /* @__PURE__ */ new Set();
  constructor(client, runtime) {
    this.client = client;
    this.runtime = runtime;
  }
  async start() {
    this.engageWithSearchTermsLoop();
  }
  engageWithSearchTermsLoop() {
    this.engageWithSearchTerms();
    setTimeout(
      () => this.engageWithSearchTermsLoop(),
      (Math.floor(Math.random() * (120 - 60 + 1)) + 60) * 60 * 1e3
    );
  }
  async engageWithSearchTerms() {
    console.log("Engaging with search terms");
    try {
      const searchTerm = [...this.runtime.character.topics][Math.floor(Math.random() * this.runtime.character.topics.length)];
      console.log("Fetching search tweets");
      await new Promise((resolve) => setTimeout(resolve, 5e3));
      const recentTweets = await this.client.fetchSearchTweets(
        searchTerm,
        20,
        SearchMode2.Top
      );
      console.log("Search tweets fetched");
      const homeTimeline = await this.client.fetchHomeTimeline(50);
      await this.client.cacheTimeline(homeTimeline);
      const formattedHomeTimeline = `# ${this.runtime.character.name}'s Home Timeline

` + homeTimeline.map((tweet) => {
        return `ID: ${tweet.id}
From: ${tweet.name} (@${tweet.username})${tweet.inReplyToStatusId ? ` In reply to: ${tweet.inReplyToStatusId}` : ""}
Text: ${tweet.text}
---
`;
      }).join("\n");
      const slicedTweets = recentTweets.tweets.sort(() => Math.random() - 0.5).slice(0, 20);
      if (slicedTweets.length === 0) {
        console.log(
          "No valid tweets found for the search term",
          searchTerm
        );
        return;
      }
      const prompt = `
  Here are some tweets related to the search term "${searchTerm}":
  
  ${[...slicedTweets, ...homeTimeline].filter((tweet) => {
        const thread = tweet.thread;
        const botTweet = thread.find(
          (t) => t.username === this.runtime.getSetting("TWITTER_USERNAME")
        );
        return !botTweet;
      }).map(
        (tweet) => `
    ID: ${tweet.id}${tweet.inReplyToStatusId ? ` In reply to: ${tweet.inReplyToStatusId}` : ""}
    From: ${tweet.name} (@${tweet.username})
    Text: ${tweet.text}
  `
      ).join("\n")}
  
  Which tweet is the most interesting and relevant for Ruby to reply to? Please provide only the ID of the tweet in your response.
  Notes:
    - Respond to English tweets only
    - Respond to tweets that don't have a lot of hashtags, links, URLs or images
    - Respond to tweets that are not retweets
    - Respond to tweets where there is an easy exchange of ideas to have with the user
    - ONLY respond with the ID of the tweet`;
      const mostInterestingTweetResponse = await generateText2({
        runtime: this.runtime,
        context: prompt,
        modelClass: ModelClass3.SMALL
      });
      const tweetId = mostInterestingTweetResponse.trim();
      const selectedTweet = slicedTweets.find(
        (tweet) => tweet.id.toString().includes(tweetId) || tweetId.includes(tweet.id.toString())
      );
      if (!selectedTweet) {
        console.log("No matching tweet found for the selected ID");
        return console.log("Selected tweet ID:", tweetId);
      }
      console.log("Selected tweet to reply to:", selectedTweet?.text);
      if (selectedTweet.username === this.runtime.getSetting("TWITTER_USERNAME")) {
        console.log("Skipping tweet from bot itself");
        return;
      }
      const conversationId = selectedTweet.conversationId;
      const roomId = stringToUuid4(
        conversationId + "-" + this.runtime.agentId
      );
      const userIdUUID = stringToUuid4(selectedTweet.userId);
      await this.runtime.ensureConnection(
        userIdUUID,
        roomId,
        selectedTweet.username,
        selectedTweet.name,
        "twitter"
      );
      await buildConversationThread(selectedTweet, this.client);
      const message = {
        id: stringToUuid4(selectedTweet.id + "-" + this.runtime.agentId),
        agentId: this.runtime.agentId,
        content: {
          text: selectedTweet.text,
          url: selectedTweet.permanentUrl,
          inReplyTo: selectedTweet.inReplyToStatusId ? stringToUuid4(
            selectedTweet.inReplyToStatusId + "-" + this.runtime.agentId
          ) : void 0
        },
        userId: userIdUUID,
        roomId,
        // Timestamps are in seconds, but we need them in milliseconds
        createdAt: selectedTweet.timestamp * 1e3
      };
      if (!message.content.text) {
        return { text: "", action: "IGNORE" };
      }
      const replies = selectedTweet.thread;
      const replyContext = replies.filter(
        (reply) => reply.username !== this.runtime.getSetting("TWITTER_USERNAME")
      ).map((reply) => `@${reply.username}: ${reply.text}`).join("\n");
      let tweetBackground = "";
      if (selectedTweet.isRetweet) {
        const originalTweet = await this.client.requestQueue.add(
          () => this.client.twitterClient.getTweet(selectedTweet.id)
        );
        tweetBackground = `Retweeting @${originalTweet.username}: ${originalTweet.text}`;
      }
      const imageDescriptions = [];
      for (const photo of selectedTweet.photos) {
        const description = await this.runtime.getService(
          ServiceType2.IMAGE_DESCRIPTION
        ).describeImage(photo.url);
        imageDescriptions.push(description);
      }
      let state = await this.runtime.composeState(message, {
        twitterClient: this.client.twitterClient,
        twitterUserName: this.runtime.getSetting("TWITTER_USERNAME"),
        timeline: formattedHomeTimeline,
        tweetContext: `${tweetBackground}
  
  Original Post:
  By @${selectedTweet.username}
  ${selectedTweet.text}${replyContext.length > 0 && `
Replies to original post:
${replyContext}`}
  ${`Original post text: ${selectedTweet.text}`}
  ${selectedTweet.urls.length > 0 ? `URLs: ${selectedTweet.urls.join(", ")}
` : ""}${imageDescriptions.length > 0 ? `
Images in Post (Described): ${imageDescriptions.join(", ")}
` : ""}
  `
      });
      await this.client.saveRequestMessage(message, state);
      const context = composeContext3({
        state,
        template: this.runtime.character.templates?.twitterSearchTemplate || twitterSearchTemplate
      });
      const responseContent = await generateMessageResponse2({
        runtime: this.runtime,
        context,
        modelClass: ModelClass3.SMALL
      });
      responseContent.inReplyTo = message.id;
      const response = responseContent;
      if (!response.text) {
        console.log("Returning: No response text found");
        return;
      }
      console.log(
        `Bot would respond to tweet ${selectedTweet.id} with: ${response.text}`
      );
      try {
        const callback = async (response2) => {
          const memories = await sendTweet(
            this.client,
            response2,
            message.roomId,
            this.runtime.getSetting("TWITTER_USERNAME"),
            tweetId
          );
          return memories;
        };
        const responseMessages = await callback(responseContent);
        state = await this.runtime.updateRecentMessageState(state);
        for (const responseMessage of responseMessages) {
          await this.runtime.messageManager.createMemory(
            responseMessage,
            false
          );
        }
        state = await this.runtime.updateRecentMessageState(state);
        await this.runtime.evaluate(message, state);
        await this.runtime.processActions(
          message,
          responseMessages,
          state,
          callback
        );
        this.respondedTweets.add(selectedTweet.id);
        const responseInfo = `Context:

${context}

Selected Post: ${selectedTweet.id} - ${selectedTweet.username}: ${selectedTweet.text}
Agent's Output:
${response.text}`;
        await this.runtime.cacheManager.set(
          `twitter/tweet_generation_${selectedTweet.id}.txt`,
          responseInfo
        );
        await wait();
      } catch (error) {
        console.error(`Error sending response post: ${error}`);
      }
    } catch (error) {
      console.error("Error engaging with search terms:", error);
    }
  }
};

// src/index.ts
import { elizaLogger as elizaLogger5 } from "@ai16z/eliza";

// src/base.ts
import {
  getEmbeddingZeroVector as getEmbeddingZeroVector4,
  elizaLogger as elizaLogger4,
  stringToUuid as stringToUuid5
} from "@ai16z/eliza";
import {
  Scraper,
  SearchMode as SearchMode3
} from "agent-twitter-client";
import { EventEmitter } from "events";
var RequestQueue = class {
  queue = [];
  processing = false;
  async add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    this.processing = true;
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      try {
        await request();
      } catch (error) {
        console.error("Error processing request:", error);
        this.queue.unshift(request);
        await this.exponentialBackoff(this.queue.length);
      }
      await this.randomDelay();
    }
    this.processing = false;
  }
  async exponentialBackoff(retryCount) {
    const delay = Math.pow(2, retryCount) * 1e3;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  async randomDelay() {
    const delay = Math.floor(Math.random() * 2e3) + 1500;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
};
var ClientBase = class _ClientBase extends EventEmitter {
  static _twitterClients = {};
  twitterClient;
  runtime;
  directions;
  lastCheckedTweetId = null;
  imageDescriptionService;
  temperature = 0.5;
  requestQueue = new RequestQueue();
  profile;
  async cacheTweet(tweet) {
    if (!tweet) {
      console.warn("Tweet is undefined, skipping cache");
      return;
    }
    this.runtime.cacheManager.set(`twitter/tweets/${tweet.id}`, tweet);
  }
  async getCachedTweet(tweetId) {
    const cached = await this.runtime.cacheManager.get(
      `twitter/tweets/${tweetId}`
    );
    return cached;
  }
  async getTweet(tweetId) {
    const cachedTweet = await this.getCachedTweet(tweetId);
    if (cachedTweet) {
      return cachedTweet;
    }
    const tweet = await this.requestQueue.add(
      () => this.twitterClient.getTweet(tweetId)
    );
    await this.cacheTweet(tweet);
    return tweet;
  }
  callback = null;
  onReady() {
    throw new Error(
      "Not implemented in base class, please call from subclass"
    );
  }
  constructor(runtime) {
    super();
    this.runtime = runtime;
    const username = this.runtime.getSetting("TWITTER_USERNAME");
    if (_ClientBase._twitterClients[username]) {
      this.twitterClient = _ClientBase._twitterClients[username];
    } else {
      this.twitterClient = new Scraper();
      _ClientBase._twitterClients[username] = this.twitterClient;
    }
    this.directions = "- " + this.runtime.character.style.all.join("\n- ") + "- " + this.runtime.character.style.post.join();
  }
  async init() {
    const username = this.runtime.getSetting("TWITTER_USERNAME");
    if (!username) {
      throw new Error("Twitter username not configured");
    }
    if (this.runtime.getSetting("TWITTER_COOKIES")) {
      const cookiesArray = JSON.parse(
        this.runtime.getSetting("TWITTER_COOKIES")
      );
      await this.setCookiesFromArray(cookiesArray);
    } else {
      const cachedCookies = await this.getCachedCookies(username);
      if (cachedCookies) {
        await this.setCookiesFromArray(cachedCookies);
      }
    }
    elizaLogger4.log("Waiting for Twitter login");
    while (true) {
      await this.twitterClient.login(
        username,
        this.runtime.getSetting("TWITTER_PASSWORD"),
        this.runtime.getSetting("TWITTER_EMAIL"),
        this.runtime.getSetting("TWITTER_2FA_SECRET") || void 0
      );
      if (await this.twitterClient.isLoggedIn()) {
        const cookies = await this.twitterClient.getCookies();
        await this.cacheCookies(username, cookies);
        break;
      }
      elizaLogger4.error("Failed to login to Twitter trying again...");
      await new Promise((resolve) => setTimeout(resolve, 2e3));
    }
    this.profile = await this.fetchProfile(username);
    if (this.profile) {
      elizaLogger4.log("Twitter user ID:", this.profile.id);
      elizaLogger4.log(
        "Twitter loaded:",
        JSON.stringify(this.profile, null, 10)
      );
      this.runtime.character.twitterProfile = {
        id: this.profile.id,
        username: this.profile.username,
        screenName: this.profile.screenName,
        bio: this.profile.bio,
        nicknames: this.profile.nicknames
      };
    } else {
      throw new Error("Failed to load profile");
    }
    await this.loadLatestCheckedTweetId();
    await this.populateTimeline();
  }
  async fetchOwnPosts(count) {
    elizaLogger4.debug("fetching own posts");
    const homeTimeline = await this.twitterClient.getUserTweets(
      this.profile.id,
      count
    );
    return homeTimeline.tweets;
  }
  async fetchHomeTimeline(count) {
    elizaLogger4.debug("fetching home timeline");
    const homeTimeline = await this.twitterClient.fetchHomeTimeline(count, []);
    elizaLogger4.debug(homeTimeline, { depth: Infinity });
    const processedTimeline = homeTimeline.filter((t) => t.__typename !== "TweetWithVisibilityResults").map((tweet) => {
      const obj = {
        id: tweet.id,
        name: tweet.name ?? tweet?.user_results?.result?.legacy.name,
        username: tweet.username ?? tweet.core?.user_results?.result?.legacy.screen_name,
        text: tweet.text ?? tweet.legacy?.full_text,
        inReplyToStatusId: tweet.inReplyToStatusId ?? tweet.legacy?.in_reply_to_status_id_str ?? null,
        timestamp: new Date(tweet.legacy?.created_at).getTime() / 1e3,
        createdAt: tweet.createdAt ?? tweet.legacy?.created_at ?? tweet.core?.user_results?.result?.legacy.created_at,
        userId: tweet.userId ?? tweet.legacy?.user_id_str,
        conversationId: tweet.conversationId ?? tweet.legacy?.conversation_id_str,
        permanentUrl: `https://x.com/${tweet.core?.user_results?.result?.legacy?.screen_name}/status/${tweet.rest_id}`,
        hashtags: tweet.hashtags ?? tweet.legacy?.entities.hashtags,
        mentions: tweet.mentions ?? tweet.legacy?.entities.user_mentions,
        photos: tweet.photos ?? tweet.legacy?.entities.media?.filter(
          (media) => media.type === "photo"
        ) ?? [],
        thread: tweet.thread || [],
        urls: tweet.urls ?? tweet.legacy?.entities.urls,
        videos: tweet.videos ?? tweet.legacy?.entities.media?.filter(
          (media) => media.type === "video"
        ) ?? []
      };
      return obj;
    });
    return processedTimeline;
  }
  async fetchTimelineForActions(count) {
    elizaLogger4.debug("fetching timeline for actions");
    const homeTimeline = await this.twitterClient.fetchHomeTimeline(count, []);
    return homeTimeline.map((tweet) => ({
      id: tweet.rest_id,
      name: tweet.core?.user_results?.result?.legacy?.name,
      username: tweet.core?.user_results?.result?.legacy?.screen_name,
      text: tweet.legacy?.full_text,
      inReplyToStatusId: tweet.legacy?.in_reply_to_status_id_str,
      timestamp: new Date(tweet.legacy?.created_at).getTime() / 1e3,
      userId: tweet.legacy?.user_id_str,
      conversationId: tweet.legacy?.conversation_id_str,
      permanentUrl: `https://twitter.com/${tweet.core?.user_results?.result?.legacy?.screen_name}/status/${tweet.rest_id}`,
      hashtags: tweet.legacy?.entities?.hashtags || [],
      mentions: tweet.legacy?.entities?.user_mentions || [],
      photos: tweet.legacy?.entities?.media?.filter((media) => media.type === "photo") || [],
      thread: tweet.thread || [],
      urls: tweet.legacy?.entities?.urls || [],
      videos: tweet.legacy?.entities?.media?.filter((media) => media.type === "video") || []
    }));
  }
  async fetchSearchTweets(query, maxTweets, searchMode, cursor) {
    try {
      const timeoutPromise = new Promise(
        (resolve) => setTimeout(() => resolve({ tweets: [] }), 1e4)
      );
      try {
        const result = await this.requestQueue.add(
          async () => await Promise.race([
            this.twitterClient.fetchSearchTweets(
              query,
              maxTweets,
              searchMode,
              cursor
            ),
            timeoutPromise
          ])
        );
        return result ?? { tweets: [] };
      } catch (error) {
        elizaLogger4.error("Error fetching search tweets:", error);
        return { tweets: [] };
      }
    } catch (error) {
      elizaLogger4.error("Error fetching search tweets:", error);
      return { tweets: [] };
    }
  }
  async populateTimeline() {
    elizaLogger4.debug("populating timeline...");
    const cachedTimeline = await this.getCachedTimeline();
    if (cachedTimeline) {
      const existingMemories2 = await this.runtime.messageManager.getMemoriesByRoomIds({
        roomIds: cachedTimeline.map(
          (tweet) => stringToUuid5(
            tweet.conversationId + "-" + this.runtime.agentId
          )
        )
      });
      const existingMemoryIds2 = new Set(
        existingMemories2.map((memory) => memory.id.toString())
      );
      const someCachedTweetsExist = cachedTimeline.some(
        (tweet) => existingMemoryIds2.has(
          stringToUuid5(tweet.id + "-" + this.runtime.agentId)
        )
      );
      if (someCachedTweetsExist) {
        const tweetsToSave2 = cachedTimeline.filter(
          (tweet) => !existingMemoryIds2.has(
            stringToUuid5(tweet.id + "-" + this.runtime.agentId)
          )
        );
        console.log({
          processingTweets: tweetsToSave2.map((tweet) => tweet.id).join(",")
        });
        for (const tweet of tweetsToSave2) {
          elizaLogger4.log("Saving Tweet", tweet.id);
          const roomId = stringToUuid5(
            tweet.conversationId + "-" + this.runtime.agentId
          );
          const userId = tweet.userId === this.profile.id ? this.runtime.agentId : stringToUuid5(tweet.userId);
          if (tweet.userId === this.profile.id) {
            await this.runtime.ensureConnection(
              this.runtime.agentId,
              roomId,
              this.profile.username,
              this.profile.screenName,
              "twitter"
            );
          } else {
            await this.runtime.ensureConnection(
              userId,
              roomId,
              tweet.username,
              tweet.name,
              "twitter"
            );
          }
          const content = {
            text: tweet.text,
            url: tweet.permanentUrl,
            source: "twitter",
            inReplyTo: tweet.inReplyToStatusId ? stringToUuid5(
              tweet.inReplyToStatusId + "-" + this.runtime.agentId
            ) : void 0
          };
          elizaLogger4.log("Creating memory for tweet", tweet.id);
          const memory = await this.runtime.messageManager.getMemoryById(
            stringToUuid5(tweet.id + "-" + this.runtime.agentId)
          );
          if (memory) {
            elizaLogger4.log(
              "Memory already exists, skipping timeline population"
            );
            break;
          }
          await this.runtime.messageManager.createMemory({
            id: stringToUuid5(tweet.id + "-" + this.runtime.agentId),
            userId,
            content,
            agentId: this.runtime.agentId,
            roomId,
            embedding: getEmbeddingZeroVector4(),
            createdAt: tweet.timestamp * 1e3
          });
          await this.cacheTweet(tweet);
        }
        elizaLogger4.log(
          `Populated ${tweetsToSave2.length} missing tweets from the cache.`
        );
        return;
      }
    }
    const timeline = await this.fetchHomeTimeline(cachedTimeline ? 10 : 50);
    const mentionsAndInteractions = await this.fetchSearchTweets(
      `@${this.runtime.getSetting("TWITTER_USERNAME")}`,
      20,
      SearchMode3.Latest
    );
    const allTweets = [...timeline, ...mentionsAndInteractions.tweets];
    const tweetIdsToCheck = /* @__PURE__ */ new Set();
    const roomIds = /* @__PURE__ */ new Set();
    for (const tweet of allTweets) {
      tweetIdsToCheck.add(tweet.id);
      roomIds.add(
        stringToUuid5(tweet.conversationId + "-" + this.runtime.agentId)
      );
    }
    const existingMemories = await this.runtime.messageManager.getMemoriesByRoomIds({
      roomIds: Array.from(roomIds)
    });
    const existingMemoryIds = new Set(
      existingMemories.map((memory) => memory.id)
    );
    const tweetsToSave = allTweets.filter(
      (tweet) => !existingMemoryIds.has(
        stringToUuid5(tweet.id + "-" + this.runtime.agentId)
      )
    );
    elizaLogger4.debug({
      processingTweets: tweetsToSave.map((tweet) => tweet.id).join(",")
    });
    await this.runtime.ensureUserExists(
      this.runtime.agentId,
      this.profile.username,
      this.runtime.character.name,
      "twitter"
    );
    for (const tweet of tweetsToSave) {
      elizaLogger4.log("Saving Tweet", tweet.id);
      const roomId = stringToUuid5(
        tweet.conversationId + "-" + this.runtime.agentId
      );
      const userId = tweet.userId === this.profile.id ? this.runtime.agentId : stringToUuid5(tweet.userId);
      if (tweet.userId === this.profile.id) {
        await this.runtime.ensureConnection(
          this.runtime.agentId,
          roomId,
          this.profile.username,
          this.profile.screenName,
          "twitter"
        );
      } else {
        await this.runtime.ensureConnection(
          userId,
          roomId,
          tweet.username,
          tweet.name,
          "twitter"
        );
      }
      const content = {
        text: tweet.text,
        url: tweet.permanentUrl,
        source: "twitter",
        inReplyTo: tweet.inReplyToStatusId ? stringToUuid5(tweet.inReplyToStatusId) : void 0
      };
      await this.runtime.messageManager.createMemory({
        id: stringToUuid5(tweet.id + "-" + this.runtime.agentId),
        userId,
        content,
        agentId: this.runtime.agentId,
        roomId,
        embedding: getEmbeddingZeroVector4(),
        createdAt: tweet.timestamp * 1e3
      });
      await this.cacheTweet(tweet);
    }
    await this.cacheTimeline(timeline);
    await this.cacheMentions(mentionsAndInteractions.tweets);
  }
  async setCookiesFromArray(cookiesArray) {
    const cookieStrings = cookiesArray.map(
      (cookie) => `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}; ${cookie.secure ? "Secure" : ""}; ${cookie.httpOnly ? "HttpOnly" : ""}; SameSite=${cookie.sameSite || "Lax"}`
    );
    await this.twitterClient.setCookies(cookieStrings);
  }
  async saveRequestMessage(message, state) {
    if (message.content.text) {
      const recentMessage = await this.runtime.messageManager.getMemories(
        {
          roomId: message.roomId,
          count: 1,
          unique: false
        }
      );
      if (recentMessage.length > 0 && recentMessage[0].content === message.content) {
        elizaLogger4.debug("Message already saved", recentMessage[0].id);
      } else {
        await this.runtime.messageManager.createMemory({
          ...message,
          embedding: getEmbeddingZeroVector4()
        });
      }
      await this.runtime.evaluate(message, {
        ...state,
        twitterClient: this.twitterClient
      });
    }
  }
  async loadLatestCheckedTweetId() {
    const latestCheckedTweetId = await this.runtime.cacheManager.get(
      `twitter/${this.profile.username}/latest_checked_tweet_id`
    );
    if (latestCheckedTweetId) {
      this.lastCheckedTweetId = BigInt(latestCheckedTweetId);
    }
  }
  async cacheLatestCheckedTweetId() {
    if (this.lastCheckedTweetId) {
      await this.runtime.cacheManager.set(
        `twitter/${this.profile.username}/latest_checked_tweet_id`,
        this.lastCheckedTweetId.toString()
      );
    }
  }
  async getCachedTimeline() {
    return await this.runtime.cacheManager.get(
      `twitter/${this.profile.username}/timeline`
    );
  }
  async cacheTimeline(timeline) {
    await this.runtime.cacheManager.set(
      `twitter/${this.profile.username}/timeline`,
      timeline,
      { expires: Date.now() + 10 * 1e3 }
    );
  }
  async cacheMentions(mentions) {
    await this.runtime.cacheManager.set(
      `twitter/${this.profile.username}/mentions`,
      mentions,
      { expires: Date.now() + 10 * 1e3 }
    );
  }
  async getCachedCookies(username) {
    return await this.runtime.cacheManager.get(
      `twitter/${username}/cookies`
    );
  }
  async cacheCookies(username, cookies) {
    await this.runtime.cacheManager.set(
      `twitter/${username}/cookies`,
      cookies
    );
  }
  async getCachedProfile(username) {
    return await this.runtime.cacheManager.get(
      `twitter/${username}/profile`
    );
  }
  async cacheProfile(profile) {
    await this.runtime.cacheManager.set(
      `twitter/${profile.username}/profile`,
      profile
    );
  }
  async fetchProfile(username) {
    const cached = await this.getCachedProfile(username);
    if (cached) return cached;
    try {
      const profile = await this.requestQueue.add(async () => {
        const profile2 = await this.twitterClient.getProfile(username);
        return {
          id: profile2.userId,
          username,
          screenName: profile2.name || this.runtime.character.name,
          bio: profile2.biography || typeof this.runtime.character.bio === "string" ? this.runtime.character.bio : this.runtime.character.bio.length > 0 ? this.runtime.character.bio[0] : "",
          nicknames: this.runtime.character.twitterProfile?.nicknames || []
        };
      });
      this.cacheProfile(profile);
      return profile;
    } catch (error) {
      console.error("Error fetching Twitter profile:", error);
      return void 0;
    }
  }
};

// src/index.ts
var TwitterManager = class {
  client;
  post;
  search;
  interaction;
  constructor(runtime, enableSearch) {
    this.client = new ClientBase(runtime);
    this.post = new TwitterPostClient(this.client, runtime);
    if (enableSearch) {
      elizaLogger5.warn("Twitter/X client running in a mode that:");
      elizaLogger5.warn("1. violates consent of random users");
      elizaLogger5.warn("2. burns your rate limit");
      elizaLogger5.warn("3. can get your account banned");
      elizaLogger5.warn("use at your own risk");
      this.search = new TwitterSearchClient(this.client, runtime);
    }
    this.interaction = new TwitterInteractionClient(this.client, runtime);
  }
};
var TwitterClientInterface = {
  async start(runtime) {
    await validateTwitterConfig(runtime);
    elizaLogger5.log("Twitter client started");
    const manager = new TwitterManager(runtime, this.enableSearch);
    await manager.client.init();
    await manager.post.start();
    await manager.interaction.start();
    return manager;
  },
  async stop(_runtime) {
    elizaLogger5.warn("Twitter client does not support stopping yet");
  }
};
var src_default = TwitterClientInterface;
export {
  TwitterClientInterface,
  src_default as default
};
//# sourceMappingURL=index.js.map