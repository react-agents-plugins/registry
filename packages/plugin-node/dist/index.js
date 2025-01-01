import {
  require_node_ponyfill
} from "./chunk-BR27BNBP.js";
import {
  __commonJS,
  __toESM
} from "./chunk-PLDDJCW6.js";

// ../../node_modules/deepmerge/dist/cjs.js
var require_cjs = __commonJS({
  "../../node_modules/deepmerge/dist/cjs.js"(exports, module) {
    "use strict";
    var isMergeableObject = function isMergeableObject2(value) {
      return isNonNullObject(value) && !isSpecial(value);
    };
    function isNonNullObject(value) {
      return !!value && typeof value === "object";
    }
    function isSpecial(value) {
      var stringValue = Object.prototype.toString.call(value);
      return stringValue === "[object RegExp]" || stringValue === "[object Date]" || isReactElement(value);
    }
    var canUseSymbol = typeof Symbol === "function" && Symbol.for;
    var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for("react.element") : 60103;
    function isReactElement(value) {
      return value.$$typeof === REACT_ELEMENT_TYPE;
    }
    function emptyTarget(val) {
      return Array.isArray(val) ? [] : {};
    }
    function cloneUnlessOtherwiseSpecified(value, options) {
      return options.clone !== false && options.isMergeableObject(value) ? deepmerge(emptyTarget(value), value, options) : value;
    }
    function defaultArrayMerge(target, source, options) {
      return target.concat(source).map(function(element) {
        return cloneUnlessOtherwiseSpecified(element, options);
      });
    }
    function getMergeFunction(key, options) {
      if (!options.customMerge) {
        return deepmerge;
      }
      var customMerge = options.customMerge(key);
      return typeof customMerge === "function" ? customMerge : deepmerge;
    }
    function getEnumerableOwnPropertySymbols(target) {
      return Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(target).filter(function(symbol) {
        return Object.propertyIsEnumerable.call(target, symbol);
      }) : [];
    }
    function getKeys(target) {
      return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target));
    }
    function propertyIsOnObject(object, property) {
      try {
        return property in object;
      } catch (_) {
        return false;
      }
    }
    function propertyIsUnsafe(target, key) {
      return propertyIsOnObject(target, key) && !(Object.hasOwnProperty.call(target, key) && Object.propertyIsEnumerable.call(target, key));
    }
    function mergeObject(target, source, options) {
      var destination = {};
      if (options.isMergeableObject(target)) {
        getKeys(target).forEach(function(key) {
          destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
        });
      }
      getKeys(source).forEach(function(key) {
        if (propertyIsUnsafe(target, key)) {
          return;
        }
        if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
          destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
        } else {
          destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
        }
      });
      return destination;
    }
    function deepmerge(target, source, options) {
      options = options || {};
      options.arrayMerge = options.arrayMerge || defaultArrayMerge;
      options.isMergeableObject = options.isMergeableObject || isMergeableObject;
      options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;
      var sourceIsArray = Array.isArray(source);
      var targetIsArray = Array.isArray(target);
      var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;
      if (!sourceAndTargetTypesMatch) {
        return cloneUnlessOtherwiseSpecified(source, options);
      } else if (sourceIsArray) {
        return options.arrayMerge(target, source, options);
      } else {
        return mergeObject(target, source, options);
      }
    }
    deepmerge.all = function deepmergeAll(array, options) {
      if (!Array.isArray(array)) {
        throw new Error("first argument should be an array");
      }
      return array.reduce(function(prev, next) {
        return deepmerge(prev, next, options);
      }, {});
    };
    var deepmerge_1 = deepmerge;
    module.exports = deepmerge_1;
  }
});

// src/services/browser.ts
import { generateText, trimTokens } from "@ai16z/eliza";
import { parseJSONObjectFromText } from "@ai16z/eliza";
import { Service } from "@ai16z/eliza";
import { settings } from "@ai16z/eliza";
import { ModelClass, ServiceType } from "@ai16z/eliza";
import { stringToUuid } from "@ai16z/eliza";
import { PlaywrightBlocker } from "@cliqz/adblocker-playwright";
import CaptchaSolver from "capsolver-npm";
import { chromium } from "playwright";
async function generateSummary(runtime, text) {
  text = trimTokens(text, 1e5, "gpt-4o-mini");
  const prompt = `Please generate a concise summary for the following text:
  
  Text: """
  ${text}
  """
  
  Respond with a JSON object in the following format:
  \`\`\`json
  {
    "title": "Generated Title",
    "summary": "Generated summary and/or description of the text"
  }
  \`\`\``;
  const response = await generateText({
    runtime,
    context: prompt,
    modelClass: ModelClass.SMALL
  });
  const parsedResponse = parseJSONObjectFromText(response);
  if (parsedResponse) {
    return {
      title: parsedResponse.title,
      description: parsedResponse.summary
    };
  }
  return {
    title: "",
    description: ""
  };
}
var BrowserService = class _BrowserService extends Service {
  browser;
  context;
  blocker;
  captchaSolver;
  cacheKey = "content/browser";
  static serviceType = ServiceType.BROWSER;
  static register(runtime) {
    return runtime;
  }
  getInstance() {
    return _BrowserService.getInstance();
  }
  constructor() {
    super();
    this.browser = void 0;
    this.context = void 0;
    this.blocker = void 0;
    this.captchaSolver = new CaptchaSolver(
      settings.CAPSOLVER_API_KEY || ""
    );
  }
  async initialize() {
  }
  async initializeBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          "--disable-dev-shm-usage",
          // Uses /tmp instead of /dev/shm. Prevents memory issues on low-memory systems
          "--block-new-web-contents"
          // Prevents creation of new windows/tabs
        ]
      });
      const platform = process.platform;
      let userAgent = "";
      switch (platform) {
        case "darwin":
          userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
          break;
        case "win32":
          userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
          break;
        case "linux":
          userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
          break;
        default:
          userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
      }
      this.context = await this.browser.newContext({
        userAgent,
        acceptDownloads: false
      });
      this.blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
    }
  }
  async closeBrowser() {
    if (this.context) {
      await this.context.close();
      this.context = void 0;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = void 0;
    }
  }
  async getPageContent(url, runtime) {
    await this.initializeBrowser();
    return await this.fetchPageContent(url, runtime);
  }
  getCacheKey(url) {
    return stringToUuid(url);
  }
  async fetchPageContent(url, runtime) {
    const cacheKey = this.getCacheKey(url);
    const cached = await runtime.cacheManager.get(`${this.cacheKey}/${cacheKey}`);
    if (cached) {
      return cached.content;
    }
    let page;
    try {
      if (!this.context) {
        console.log(
          "Browser context not initialized. Call initializeBrowser() first."
        );
      }
      page = await this.context.newPage();
      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9"
      });
      if (this.blocker) {
        await this.blocker.enableBlockingInPage(page);
      }
      const response = await page.goto(url, { waitUntil: "networkidle" });
      if (!response) {
        console.log("Failed to load the page");
      }
      if (response.status() === 403 || response.status() === 404) {
        return await this.tryAlternativeSources(url, runtime);
      }
      const captchaDetected = await this.detectCaptcha(page);
      if (captchaDetected) {
        await this.solveCaptcha(page, url);
      }
      const documentTitle = await page.evaluate(() => document.title);
      const bodyContent = await page.evaluate(
        () => document.body.innerText
      );
      const { title: parsedTitle, description } = await generateSummary(
        runtime,
        documentTitle + "\n" + bodyContent
      );
      const content = { title: parsedTitle, description, bodyContent };
      await runtime.cacheManager.set(`${this.cacheKey}/${cacheKey}`, {
        url,
        content
      });
      return content;
    } catch (error) {
      console.error("Error:", error);
      return {
        title: url,
        description: "Error, could not fetch content",
        bodyContent: ""
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }
  async detectCaptcha(page) {
    const captchaSelectors = [
      'iframe[src*="captcha"]',
      'div[class*="captcha"]',
      "#captcha",
      ".g-recaptcha",
      ".h-captcha"
    ];
    for (const selector of captchaSelectors) {
      const element = await page.$(selector);
      if (element) return true;
    }
    return false;
  }
  async solveCaptcha(page, url) {
    try {
      const hcaptchaKey = await this.getHCaptchaWebsiteKey(page);
      if (hcaptchaKey) {
        const solution = await this.captchaSolver.hcaptchaProxyless({
          websiteURL: url,
          websiteKey: hcaptchaKey
        });
        await page.evaluate((token) => {
          window.hcaptcha.setResponse(token);
        }, solution.gRecaptchaResponse);
        return;
      }
      const recaptchaKey = await this.getReCaptchaWebsiteKey(page);
      if (recaptchaKey) {
        const solution = await this.captchaSolver.recaptchaV2Proxyless({
          websiteURL: url,
          websiteKey: recaptchaKey
        });
        await page.evaluate((token) => {
          document.getElementById("g-recaptcha-response").innerHTML = token;
        }, solution.gRecaptchaResponse);
      }
    } catch (error) {
      console.error("Error solving CAPTCHA:", error);
    }
  }
  async getHCaptchaWebsiteKey(page) {
    return page.evaluate(() => {
      const hcaptchaIframe = document.querySelector(
        'iframe[src*="hcaptcha.com"]'
      );
      if (hcaptchaIframe) {
        const src = hcaptchaIframe.getAttribute("src");
        const match = src?.match(/sitekey=([^&]*)/);
        return match ? match[1] : "";
      }
      return "";
    });
  }
  async getReCaptchaWebsiteKey(page) {
    return page.evaluate(() => {
      const recaptchaElement = document.querySelector(".g-recaptcha");
      return recaptchaElement ? recaptchaElement.getAttribute("data-sitekey") || "" : "";
    });
  }
  async tryAlternativeSources(url, runtime) {
    const archiveUrl = `https://web.archive.org/web/${url}`;
    try {
      return await this.fetchPageContent(archiveUrl, runtime);
    } catch (error) {
      console.error("Error fetching from Internet Archive:", error);
    }
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    try {
      return await this.fetchPageContent(googleSearchUrl, runtime);
    } catch (error) {
      console.error("Error fetching from Google Search:", error);
      console.error("Failed to fetch content from alternative sources");
      return {
        title: url,
        description: "Error, could not fetch content from alternative sources",
        bodyContent: ""
      };
    }
  }
};

// src/services/image.ts
import { elizaLogger, models } from "@ai16z/eliza";
import { Service as Service2 } from "@ai16z/eliza";
import {
  ModelProviderName,
  ServiceType as ServiceType2
} from "@ai16z/eliza";
import {
  AutoProcessor,
  AutoTokenizer,
  env,
  Florence2ForConditionalGeneration,
  RawImage
} from "@huggingface/transformers";
import fs from "fs";
import gifFrames from "gif-frames";
import os from "os";
import path from "path";
var ImageDescriptionService = class _ImageDescriptionService extends Service2 {
  static serviceType = ServiceType2.IMAGE_DESCRIPTION;
  modelId = "onnx-community/Florence-2-base-ft";
  device = "gpu";
  model = null;
  processor = null;
  tokenizer = null;
  initialized = false;
  runtime = null;
  queue = [];
  processing = false;
  getInstance() {
    return _ImageDescriptionService.getInstance();
  }
  async initialize(runtime) {
    console.log("Initializing ImageDescriptionService");
    this.runtime = runtime;
  }
  async initializeLocalModel() {
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.backends.onnx.logLevel = "fatal";
    env.backends.onnx.wasm.proxy = false;
    env.backends.onnx.wasm.numThreads = 1;
    elizaLogger.info("Downloading Florence model...");
    this.model = await Florence2ForConditionalGeneration.from_pretrained(
      this.modelId,
      {
        device: "gpu",
        progress_callback: (progress) => {
          if (progress.status === "downloading") {
            const percent = (progress.loaded / progress.total * 100).toFixed(1);
            const dots = ".".repeat(
              Math.floor(Number(percent) / 5)
            );
            elizaLogger.info(
              `Downloading Florence model: [${dots.padEnd(20, " ")}] ${percent}%`
            );
          }
        }
      }
    );
    elizaLogger.success("Florence model downloaded successfully");
    elizaLogger.info("Downloading processor...");
    this.processor = await AutoProcessor.from_pretrained(
      this.modelId
    );
    elizaLogger.info("Downloading tokenizer...");
    this.tokenizer = await AutoTokenizer.from_pretrained(this.modelId);
    elizaLogger.success("Image service initialization complete");
  }
  async describeImage(imageUrl) {
    if (!this.initialized) {
      const model = models[this.runtime?.character?.modelProvider];
      if (model === models[ModelProviderName.LLAMALOCAL]) {
        await this.initializeLocalModel();
      } else {
        this.modelId = "gpt-4o-mini";
        this.device = "cloud";
      }
      this.initialized = true;
    }
    if (this.device === "cloud") {
      if (!this.runtime) {
        throw new Error(
          "Runtime is required for OpenAI image recognition"
        );
      }
      return this.recognizeWithOpenAI(imageUrl);
    }
    this.queue.push(imageUrl);
    this.processQueue();
    return new Promise((resolve, _reject) => {
      const checkQueue = () => {
        const index = this.queue.indexOf(imageUrl);
        if (index !== -1) {
          setTimeout(checkQueue, 100);
        } else {
          resolve(this.processImage(imageUrl));
        }
      };
      checkQueue();
    });
  }
  async recognizeWithOpenAI(imageUrl) {
    const isGif = imageUrl.toLowerCase().endsWith(".gif");
    let imageData = null;
    try {
      if (isGif) {
        const { filePath } = await this.extractFirstFrameFromGif(imageUrl);
        imageData = fs.readFileSync(filePath);
      } else {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch image: ${response.statusText}`
          );
        }
        imageData = Buffer.from(await response.arrayBuffer());
      }
      if (!imageData || imageData.length === 0) {
        throw new Error("Failed to fetch image data");
      }
      const prompt = "Describe this image and give it a title. The first line should be the title, and then a line break, then a detailed description of the image. Respond with the format 'title\ndescription'";
      const text = await this.requestOpenAI(
        imageUrl,
        imageData,
        prompt,
        isGif
      );
      const [title, ...descriptionParts] = text.split("\n");
      return {
        title,
        description: descriptionParts.join("\n")
      };
    } catch (error) {
      elizaLogger.error("Error in recognizeWithOpenAI:", error);
      throw error;
    }
  }
  async requestOpenAI(imageUrl, imageData, prompt, isGif) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const content = [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: isGif ? `data:image/png;base64,${imageData.toString("base64")}` : imageUrl
            }
          }
        ];
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.runtime.getSetting("OPENAI_API_KEY")}`
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content }],
              max_tokens: isGif ? 500 : 300
            })
          }
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
      } catch (error) {
        elizaLogger.error(
          `OpenAI request failed (attempt ${attempt + 1}):`,
          error
        );
        if (attempt === 2) throw error;
      }
    }
    throw new Error(
      "Failed to recognize image with OpenAI after 3 attempts"
    );
  }
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const imageUrl = this.queue.shift();
      await this.processImage(imageUrl);
    }
    this.processing = false;
  }
  async processImage(imageUrl) {
    if (!this.model || !this.processor || !this.tokenizer) {
      throw new Error("Model components not initialized");
    }
    elizaLogger.log("Processing image:", imageUrl);
    const isGif = imageUrl.toLowerCase().endsWith(".gif");
    let imageToProcess = imageUrl;
    try {
      if (isGif) {
        elizaLogger.log("Extracting first frame from GIF");
        const { filePath } = await this.extractFirstFrameFromGif(imageUrl);
        imageToProcess = filePath;
      }
      const image = await RawImage.fromURL(imageToProcess);
      const visionInputs = await this.processor(image);
      const prompts = this.processor.construct_prompts("<DETAILED_CAPTION>");
      const textInputs = this.tokenizer(prompts);
      elizaLogger.log("Generating image description");
      const generatedIds = await this.model.generate({
        ...textInputs,
        ...visionInputs,
        max_new_tokens: 256
      });
      const generatedText = this.tokenizer.batch_decode(generatedIds, {
        skip_special_tokens: false
      })[0];
      const result = this.processor.post_process_generation(
        generatedText,
        "<DETAILED_CAPTION>",
        image.size
      );
      const detailedCaption = result["<DETAILED_CAPTION>"];
      return { title: detailedCaption, description: detailedCaption };
    } catch (error) {
      elizaLogger.error("Error processing image:", error);
      throw error;
    } finally {
      if (isGif && imageToProcess !== imageUrl) {
        fs.unlinkSync(imageToProcess);
      }
    }
  }
  async extractFirstFrameFromGif(gifUrl) {
    const frameData = await gifFrames({
      url: gifUrl,
      frames: 1,
      outputType: "png"
    });
    const tempFilePath = path.join(
      os.tmpdir(),
      `gif_frame_${Date.now()}.png`
    );
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempFilePath);
      frameData[0].getImage().pipe(writeStream);
      writeStream.on("finish", () => resolve({ filePath: tempFilePath }));
      writeStream.on("error", reject);
    });
  }
};

// src/services/llama.ts
import {
  elizaLogger as elizaLogger2,
  ServiceType as ServiceType3,
  ModelProviderName as ModelProviderName2
} from "@ai16z/eliza";
import { Service as Service3 } from "@ai16z/eliza";
import fs2 from "fs";
import https from "https";
import {
  getLlama,
  LlamaJsonSchemaGrammar
} from "node-llama-cpp";
import path2 from "path";
import si from "systeminformation";
import { fileURLToPath } from "url";
var wordsToPunish = [
  " please",
  " feel",
  " free",
  "!",
  "\u2013",
  "\u2014",
  "?",
  ".",
  ",",
  "; ",
  " cosmos",
  " tapestry",
  " tapestries",
  " glitch",
  " matrix",
  " cyberspace",
  " troll",
  " questions",
  " topics",
  " discuss",
  " basically",
  " simulation",
  " simulate",
  " universe",
  " like",
  " debug",
  " debugging",
  " wild",
  " existential",
  " juicy",
  " circuits",
  " help",
  " ask",
  " happy",
  " just",
  " cosmic",
  " cool",
  " joke",
  " punchline",
  " fancy",
  " glad",
  " assist",
  " algorithm",
  " Indeed",
  " Furthermore",
  " However",
  " Notably",
  " Therefore",
  " Additionally",
  " conclusion",
  " Significantly",
  " Consequently",
  " Thus",
  " What",
  " Otherwise",
  " Moreover",
  " Subsequently",
  " Accordingly",
  " Unlock",
  " Unleash",
  " buckle",
  " pave",
  " forefront",
  " harness",
  " harnessing",
  " bridging",
  " bridging",
  " Spearhead",
  " spearheading",
  " Foster",
  " foster",
  " environmental",
  " impact",
  " Navigate",
  " navigating",
  " challenges",
  " chaos",
  " social",
  " inclusion",
  " inclusive",
  " diversity",
  " diverse",
  " delve",
  " noise",
  " infinite",
  " insanity",
  " coffee",
  " singularity",
  " AI",
  " digital",
  " artificial",
  " intelligence",
  " consciousness",
  " reality",
  " metaverse",
  " virtual",
  " virtual reality",
  " VR",
  " Metaverse",
  " humanity"
];
var __dirname = path2.dirname(fileURLToPath(import.meta.url));
var jsonSchemaGrammar = {
  type: "object",
  properties: {
    user: {
      type: "string"
    },
    content: {
      type: "string"
    }
  }
};
var LlamaService = class extends Service3 {
  llama;
  model;
  modelPath;
  grammar;
  ctx;
  sequence;
  modelUrl;
  ollamaModel;
  messageQueue = [];
  isProcessing = false;
  modelInitialized = false;
  runtime;
  static serviceType = ServiceType3.TEXT_GENERATION;
  constructor() {
    super();
    this.llama = void 0;
    this.model = void 0;
    this.modelUrl = "https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q8_0.gguf?download=true";
    const modelName = "model.gguf";
    this.modelPath = path2.join(
      process.env.LLAMALOCAL_PATH?.trim() ?? "./",
      modelName
    );
    this.ollamaModel = process.env.OLLAMA_MODEL;
  }
  async initialize(runtime) {
    elizaLogger2.info("Initializing LlamaService...");
    this.runtime = runtime;
  }
  async ensureInitialized() {
    if (!this.modelInitialized) {
      elizaLogger2.info(
        "Model not initialized, starting initialization..."
      );
      await this.initializeModel();
    } else {
      elizaLogger2.info("Model already initialized");
    }
  }
  async initializeModel() {
    try {
      elizaLogger2.info("Checking model file...");
      await this.checkModel();
      const systemInfo = await si.graphics();
      const hasCUDA = systemInfo.controllers.some(
        (controller) => controller.vendor.toLowerCase().includes("nvidia")
      );
      if (hasCUDA) {
        elizaLogger2.info(
          "LlamaService: CUDA detected, using GPU acceleration"
        );
      } else {
        elizaLogger2.warn(
          "LlamaService: No CUDA detected - local response will be slow"
        );
      }
      elizaLogger2.info("Initializing Llama instance...");
      this.llama = await getLlama({
        gpu: hasCUDA ? "cuda" : void 0
      });
      elizaLogger2.info("Creating JSON schema grammar...");
      const grammar = new LlamaJsonSchemaGrammar(
        this.llama,
        jsonSchemaGrammar
      );
      this.grammar = grammar;
      elizaLogger2.info("Loading model...");
      this.model = await this.llama.loadModel({
        modelPath: this.modelPath
      });
      elizaLogger2.info("Creating context and sequence...");
      this.ctx = await this.model.createContext({ contextSize: 8192 });
      this.sequence = this.ctx.getSequence();
      this.modelInitialized = true;
      elizaLogger2.success("Model initialization complete");
      this.processQueue();
    } catch (error) {
      elizaLogger2.error(
        "Model initialization failed. Deleting model and retrying:",
        error
      );
      try {
        elizaLogger2.info(
          "Attempting to delete and re-download model..."
        );
        await this.deleteModel();
        await this.initializeModel();
      } catch (retryError) {
        elizaLogger2.error(
          "Model re-initialization failed:",
          retryError
        );
        throw new Error(
          `Model initialization failed after retry: ${retryError.message}`
        );
      }
    }
  }
  async checkModel() {
    if (!fs2.existsSync(this.modelPath)) {
      elizaLogger2.info("Model file not found, starting download...");
      await new Promise((resolve, reject) => {
        const file = fs2.createWriteStream(this.modelPath);
        let downloadedSize = 0;
        let totalSize = 0;
        const downloadModel = (url) => {
          https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
              elizaLogger2.info(
                `Following redirect to: ${response.headers.location}`
              );
              downloadModel(response.headers.location);
              return;
            }
            if (response.statusCode !== 200) {
              reject(
                new Error(
                  `Failed to download model: HTTP ${response.statusCode}`
                )
              );
              return;
            }
            totalSize = parseInt(
              response.headers["content-length"] || "0",
              10
            );
            elizaLogger2.info(
              `Downloading model: Hermes-3-Llama-3.1-8B.Q8_0.gguf`
            );
            elizaLogger2.info(
              `Download location: ${this.modelPath}`
            );
            elizaLogger2.info(
              `Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`
            );
            response.pipe(file);
            let progressString = "";
            response.on("data", (chunk) => {
              downloadedSize += chunk.length;
              const progress = totalSize > 0 ? (downloadedSize / totalSize * 100).toFixed(1) : "0.0";
              const dots = ".".repeat(
                Math.floor(Number(progress) / 5)
              );
              progressString = `Downloading model: [${dots.padEnd(20, " ")}] ${progress}%`;
              elizaLogger2.progress(progressString);
            });
            file.on("finish", () => {
              file.close();
              elizaLogger2.progress("");
              elizaLogger2.success("Model download complete");
              resolve();
            });
            response.on("error", (error) => {
              fs2.unlink(this.modelPath, () => {
              });
              reject(
                new Error(
                  `Model download failed: ${error.message}`
                )
              );
            });
          }).on("error", (error) => {
            fs2.unlink(this.modelPath, () => {
            });
            reject(
              new Error(
                `Model download request failed: ${error.message}`
              )
            );
          });
        };
        downloadModel(this.modelUrl);
        file.on("error", (err) => {
          fs2.unlink(this.modelPath, () => {
          });
          console.error("File write error:", err.message);
          reject(err);
        });
      });
    } else {
      elizaLogger2.warn("Model already exists.");
    }
  }
  async deleteModel() {
    if (fs2.existsSync(this.modelPath)) {
      fs2.unlinkSync(this.modelPath);
    }
  }
  async queueMessageCompletion(context, temperature, stop, frequency_penalty, presence_penalty, max_tokens) {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      this.messageQueue.push({
        context,
        temperature,
        stop,
        frequency_penalty,
        presence_penalty,
        max_tokens,
        useGrammar: true,
        resolve,
        reject
      });
      this.processQueue();
    });
  }
  async queueTextCompletion(context, temperature, stop, frequency_penalty, presence_penalty, max_tokens) {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      this.messageQueue.push({
        context,
        temperature,
        stop,
        frequency_penalty: frequency_penalty ?? 1,
        presence_penalty: presence_penalty ?? 1,
        max_tokens,
        useGrammar: false,
        resolve,
        reject
      });
      this.processQueue();
    });
  }
  async processQueue() {
    if (this.isProcessing || this.messageQueue.length === 0 || !this.modelInitialized) {
      return;
    }
    this.isProcessing = true;
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          const response = await this.getCompletionResponse(
            message.context,
            message.temperature,
            message.stop,
            message.frequency_penalty,
            message.presence_penalty,
            message.max_tokens,
            message.useGrammar
          );
          message.resolve(response);
        } catch (error) {
          message.reject(error);
        }
      }
    }
    this.isProcessing = false;
  }
  async completion(prompt, runtime) {
    try {
      await this.initialize(runtime);
      if (runtime.modelProvider === ModelProviderName2.OLLAMA) {
        return await this.ollamaCompletion(prompt);
      }
      return await this.localCompletion(prompt);
    } catch (error) {
      elizaLogger2.error("Error in completion:", error);
      throw error;
    }
  }
  async embedding(text, runtime) {
    try {
      await this.initialize(runtime);
      if (runtime.modelProvider === ModelProviderName2.OLLAMA) {
        return await this.ollamaEmbedding(text);
      }
      return await this.localEmbedding(text);
    } catch (error) {
      elizaLogger2.error("Error in embedding:", error);
      throw error;
    }
  }
  async getCompletionResponse(context, temperature, stop, frequency_penalty, presence_penalty, max_tokens, useGrammar) {
    const ollamaModel = process.env.OLLAMA_MODEL;
    if (ollamaModel) {
      const ollamaUrl = process.env.OLLAMA_SERVER_URL || "http://localhost:11434";
      elizaLogger2.info(
        `Using Ollama API at ${ollamaUrl} with model ${ollamaModel}`
      );
      const response2 = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: context,
          stream: false,
          options: {
            temperature,
            stop,
            frequency_penalty,
            presence_penalty,
            num_predict: max_tokens
          }
        })
      });
      if (!response2.ok) {
        throw new Error(
          `Ollama request failed: ${response2.statusText}`
        );
      }
      const result = await response2.json();
      return useGrammar ? { content: result.response } : result.response;
    }
    if (!this.sequence) {
      throw new Error("Model not initialized.");
    }
    const tokens = this.model.tokenize(context);
    const wordsToPunishTokens = wordsToPunish.map((word) => this.model.tokenize(word)).flat();
    const repeatPenalty = {
      punishTokens: () => wordsToPunishTokens,
      penalty: 1.2,
      frequencyPenalty: frequency_penalty,
      presencePenalty: presence_penalty
    };
    const responseTokens = [];
    for await (const token of this.sequence.evaluate(tokens, {
      temperature: Number(temperature),
      repeatPenalty,
      grammarEvaluationState: useGrammar ? this.grammar : void 0,
      yieldEogToken: false
    })) {
      const current = this.model.detokenize([...responseTokens, token]);
      if ([...stop].some((s) => current.includes(s))) {
        elizaLogger2.info("Stop sequence found");
        break;
      }
      responseTokens.push(token);
      process.stdout.write(this.model.detokenize([token]));
      if (useGrammar) {
        if (current.replaceAll("\n", "").includes("}```")) {
          elizaLogger2.info("JSON block found");
          break;
        }
      }
      if (responseTokens.length > max_tokens) {
        elizaLogger2.info("Max tokens reached");
        break;
      }
    }
    const response = this.model.detokenize(responseTokens);
    if (!response) {
      throw new Error("Response is undefined");
    }
    if (useGrammar) {
      let jsonString = response.match(/```json(.*?)```/s)?.[1].trim();
      if (!jsonString) {
        try {
          jsonString = JSON.stringify(JSON.parse(response));
        } catch {
          throw new Error("JSON string not found");
        }
      }
      try {
        const parsedResponse = JSON.parse(jsonString);
        if (!parsedResponse) {
          throw new Error("Parsed response is undefined");
        }
        await this.sequence.clearHistory();
        return parsedResponse;
      } catch (error) {
        elizaLogger2.error("Error parsing JSON:", error);
      }
    } else {
      await this.sequence.clearHistory();
      return response;
    }
  }
  async getEmbeddingResponse(input) {
    const ollamaModel = process.env.OLLAMA_MODEL;
    if (ollamaModel) {
      const ollamaUrl2 = process.env.OLLAMA_SERVER_URL || "http://localhost:11434";
      const embeddingModel2 = process.env.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large";
      elizaLogger2.info(
        `Using Ollama API for embeddings with model ${embeddingModel2} (base: ${ollamaModel})`
      );
      const response2 = await fetch(`${ollamaUrl2}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: embeddingModel2,
          prompt: input
        })
      });
      if (!response2.ok) {
        throw new Error(
          `Ollama embeddings request failed: ${response2.statusText}`
        );
      }
      const result = await response2.json();
      return result.embedding;
    }
    if (!this.sequence) {
      throw new Error("Sequence not initialized");
    }
    const ollamaUrl = process.env.OLLAMA_SERVER_URL || "http://localhost:11434";
    const embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large";
    elizaLogger2.info(
      `Using Ollama API for embeddings with model ${embeddingModel} (base: ${this.ollamaModel})`
    );
    const response = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input,
        model: embeddingModel
      })
    });
    if (!response.ok) {
      throw new Error(`Failed to get embedding: ${response.statusText}`);
    }
    const embedding = await response.json();
    return embedding.vector;
  }
  async ollamaCompletion(prompt) {
    const ollamaModel = process.env.OLLAMA_MODEL;
    const ollamaUrl = process.env.OLLAMA_SERVER_URL || "http://localhost:11434";
    elizaLogger2.info(
      `Using Ollama API at ${ollamaUrl} with model ${ollamaModel}`
    );
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          stop: ["\n"],
          frequency_penalty: 0.5,
          presence_penalty: 0.5,
          num_predict: 256
        }
      })
    });
    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }
    const result = await response.json();
    return result.response;
  }
  async ollamaEmbedding(text) {
    const ollamaModel = process.env.OLLAMA_MODEL;
    const ollamaUrl = process.env.OLLAMA_SERVER_URL || "http://localhost:11434";
    const embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large";
    elizaLogger2.info(
      `Using Ollama API for embeddings with model ${embeddingModel} (base: ${ollamaModel})`
    );
    const response = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: embeddingModel,
        prompt: text
      })
    });
    if (!response.ok) {
      throw new Error(
        `Ollama embeddings request failed: ${response.statusText}`
      );
    }
    const result = await response.json();
    return result.embedding;
  }
  async localCompletion(prompt) {
    if (!this.sequence) {
      throw new Error("Sequence not initialized");
    }
    const tokens = this.model.tokenize(prompt);
    const wordsToPunishTokens = wordsToPunish.map((word) => this.model.tokenize(word)).flat();
    const repeatPenalty = {
      punishTokens: () => wordsToPunishTokens,
      penalty: 1.2,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5
    };
    const responseTokens = [];
    for await (const token of this.sequence.evaluate(tokens, {
      temperature: 0.7,
      repeatPenalty,
      yieldEogToken: false
    })) {
      const current = this.model.detokenize([...responseTokens, token]);
      if (current.includes("\n")) {
        elizaLogger2.info("Stop sequence found");
        break;
      }
      responseTokens.push(token);
      process.stdout.write(this.model.detokenize([token]));
      if (responseTokens.length > 256) {
        elizaLogger2.info("Max tokens reached");
        break;
      }
    }
    const response = this.model.detokenize(responseTokens);
    if (!response) {
      throw new Error("Response is undefined");
    }
    await this.sequence.clearHistory();
    return response;
  }
  async localEmbedding(text) {
    if (!this.sequence) {
      throw new Error("Sequence not initialized");
    }
    const embeddingContext = await this.model.createEmbeddingContext();
    const embedding = await embeddingContext.getEmbeddingFor(text);
    return embedding?.vector ? [...embedding.vector] : void 0;
  }
};

// src/services/pdf.ts
import { Service as Service4, ServiceType as ServiceType4 } from "@ai16z/eliza";
import { getDocument } from "pdfjs-dist";
var PdfService = class _PdfService extends Service4 {
  static serviceType = ServiceType4.PDF;
  constructor() {
    super();
  }
  getInstance() {
    return _PdfService.getInstance();
  }
  async initialize(_runtime) {
  }
  async convertPdfToText(pdfBuffer) {
    const uint8Array = new Uint8Array(pdfBuffer);
    const pdf = await getDocument({ data: uint8Array }).promise;
    const numPages = pdf.numPages;
    const textPages = [];
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.filter(isTextItem).map((item) => item.str).join(" ");
      textPages.push(pageText);
    }
    return textPages.join("\n");
  }
};
function isTextItem(item) {
  return "str" in item;
}

// src/services/speech.ts
import { PassThrough, Readable } from "stream";
import { ServiceType as ServiceType5 } from "@ai16z/eliza";

// src/services/audioUtils.ts
function getWavHeader(audioLength, sampleRate, channelCount = 1, bitsPerSample = 16) {
  const wavHeader = Buffer.alloc(44);
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + audioLength, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(channelCount, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(
    sampleRate * bitsPerSample * channelCount / 8,
    28
  );
  wavHeader.writeUInt16LE(bitsPerSample * channelCount / 8, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(audioLength, 40);
  return wavHeader;
}

// src/services/speech.ts
import { Service as Service5 } from "@ai16z/eliza";

// src/environment.ts
import { z } from "zod";
var nodeEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  // Core settings
  ELEVENLABS_XI_API_KEY: z.string().optional(),
  // All other settings optional with defaults
  ELEVENLABS_MODEL_ID: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  ELEVENLABS_VOICE_STABILITY: z.string().optional(),
  ELEVENLABS_VOICE_SIMILARITY_BOOST: z.string().optional(),
  ELEVENLABS_VOICE_STYLE: z.string().optional(),
  ELEVENLABS_VOICE_USE_SPEAKER_BOOST: z.string().optional(),
  ELEVENLABS_OPTIMIZE_STREAMING_LATENCY: z.string().optional(),
  ELEVENLABS_OUTPUT_FORMAT: z.string().optional(),
  VITS_VOICE: z.string().optional(),
  VITS_MODEL: z.string().optional()
});
async function validateNodeConfig(runtime) {
  try {
    const voiceSettings = runtime.character.settings?.voice;
    const elevenlabs = voiceSettings?.elevenlabs;
    const config = {
      OPENAI_API_KEY: runtime.getSetting("OPENAI_API_KEY") || process.env.OPENAI_API_KEY,
      ELEVENLABS_XI_API_KEY: runtime.getSetting("ELEVENLABS_XI_API_KEY") || process.env.ELEVENLABS_XI_API_KEY,
      // Use character card settings first, fall back to env vars, then defaults
      ...runtime.getSetting("ELEVENLABS_XI_API_KEY") && {
        ELEVENLABS_MODEL_ID: elevenlabs?.model || process.env.ELEVENLABS_MODEL_ID || "eleven_monolingual_v1",
        ELEVENLABS_VOICE_ID: elevenlabs?.voiceId || process.env.ELEVENLABS_VOICE_ID,
        ELEVENLABS_VOICE_STABILITY: elevenlabs?.stability || process.env.ELEVENLABS_VOICE_STABILITY || "0.5",
        ELEVENLABS_VOICE_SIMILARITY_BOOST: elevenlabs?.similarityBoost || process.env.ELEVENLABS_VOICE_SIMILARITY_BOOST || "0.75",
        ELEVENLABS_VOICE_STYLE: elevenlabs?.style || process.env.ELEVENLABS_VOICE_STYLE || "0",
        ELEVENLABS_VOICE_USE_SPEAKER_BOOST: elevenlabs?.useSpeakerBoost || process.env.ELEVENLABS_VOICE_USE_SPEAKER_BOOST || "true",
        ELEVENLABS_OPTIMIZE_STREAMING_LATENCY: process.env.ELEVENLABS_OPTIMIZE_STREAMING_LATENCY || "0",
        ELEVENLABS_OUTPUT_FORMAT: process.env.ELEVENLABS_OUTPUT_FORMAT || "pcm_16000"
      },
      // VITS settings
      VITS_VOICE: voiceSettings?.model || process.env.VITS_VOICE,
      VITS_MODEL: process.env.VITS_MODEL,
      // AWS settings (only include if present)
      ...runtime.getSetting("AWS_ACCESS_KEY_ID") && {
        AWS_ACCESS_KEY_ID: runtime.getSetting("AWS_ACCESS_KEY_ID"),
        AWS_SECRET_ACCESS_KEY: runtime.getSetting("AWS_SECRET_ACCESS_KEY"),
        AWS_REGION: runtime.getSetting("AWS_REGION"),
        AWS_S3_BUCKET: runtime.getSetting("AWS_S3_BUCKET"),
        AWS_S3_UPLOAD_PATH: runtime.getSetting("AWS_S3_UPLOAD_PATH")
      }
    };
    return nodeEnvSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n");
      throw new Error(
        `Node configuration validation failed:
${errorMessages}`
      );
    }
    throw error;
  }
}

// src/services/speech.ts
import * as Echogarden from "echogarden";
import { elizaLogger as elizaLogger3 } from "@ai16z/eliza";
function prependWavHeader(readable, audioLength, sampleRate, channelCount = 1, bitsPerSample = 16) {
  const wavHeader = getWavHeader(
    audioLength,
    sampleRate,
    channelCount,
    bitsPerSample
  );
  let pushedHeader = false;
  const passThrough = new PassThrough();
  readable.on("data", function(data) {
    if (!pushedHeader) {
      passThrough.push(wavHeader);
      pushedHeader = true;
    }
    passThrough.push(data);
  });
  readable.on("end", function() {
    passThrough.end();
  });
  return passThrough;
}
async function getVoiceSettings(runtime) {
  const hasElevenLabs = !!runtime.getSetting("ELEVENLABS_XI_API_KEY");
  const useVits = !hasElevenLabs;
  const voiceSettings = runtime.character.settings?.voice;
  const elevenlabsSettings = voiceSettings?.elevenlabs;
  elizaLogger3.debug("Voice settings:", {
    hasElevenLabs,
    useVits,
    voiceSettings,
    elevenlabsSettings
  });
  return {
    elevenlabsVoiceId: elevenlabsSettings?.voiceId || runtime.getSetting("ELEVENLABS_VOICE_ID"),
    elevenlabsModel: elevenlabsSettings?.model || runtime.getSetting("ELEVENLABS_MODEL_ID") || "eleven_monolingual_v1",
    elevenlabsStability: elevenlabsSettings?.stability || runtime.getSetting("ELEVENLABS_VOICE_STABILITY") || "0.5",
    // ... other ElevenLabs settings ...
    vitsVoice: voiceSettings?.model || voiceSettings?.url || runtime.getSetting("VITS_VOICE") || "en_US-hfc_female-medium",
    useVits
  };
}
async function textToSpeech(runtime, text) {
  await validateNodeConfig(runtime);
  const { elevenlabsVoiceId } = await getVoiceSettings(runtime);
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenlabsVoiceId}/stream?optimize_streaming_latency=${runtime.getSetting("ELEVENLABS_OPTIMIZE_STREAMING_LATENCY")}&output_format=${runtime.getSetting("ELEVENLABS_OUTPUT_FORMAT")}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": runtime.getSetting("ELEVENLABS_XI_API_KEY")
        },
        body: JSON.stringify({
          model_id: runtime.getSetting("ELEVENLABS_MODEL_ID"),
          text,
          voice_settings: {
            similarity_boost: runtime.getSetting(
              "ELEVENLABS_VOICE_SIMILARITY_BOOST"
            ),
            stability: runtime.getSetting(
              "ELEVENLABS_VOICE_STABILITY"
            ),
            style: runtime.getSetting("ELEVENLABS_VOICE_STYLE"),
            use_speaker_boost: runtime.getSetting(
              "ELEVENLABS_VOICE_USE_SPEAKER_BOOST"
            )
          }
        })
      }
    );
    const status = response.status;
    if (status != 200) {
      const errorBodyString = await response.text();
      const errorBody = JSON.parse(errorBodyString);
      if (status === 401 && errorBody.detail?.status === "quota_exceeded") {
        console.log("ElevenLabs quota exceeded, falling back to VITS");
        throw new Error("QUOTA_EXCEEDED");
      }
      throw new Error(
        `Received status ${status} from Eleven Labs API: ${errorBodyString}`
      );
    }
    if (response) {
      const reader = response.body?.getReader();
      const readable = new Readable({
        read() {
          reader && // eslint-disable-line
          reader.read().then(({ done, value }) => {
            if (done) {
              this.push(null);
            } else {
              this.push(value);
            }
          });
        }
      });
      if (runtime.getSetting("ELEVENLABS_OUTPUT_FORMAT").startsWith("pcm_")) {
        const sampleRate = parseInt(
          runtime.getSetting("ELEVENLABS_OUTPUT_FORMAT").substring(4)
        );
        const withHeader = prependWavHeader(
          readable,
          1024 * 1024 * 100,
          sampleRate,
          1,
          16
        );
        return withHeader;
      } else {
        return readable;
      }
    } else {
      return new Readable({
        read() {
        }
      });
    }
  } catch (error) {
    if (error.message === "QUOTA_EXCEEDED") {
      const { vitsVoice } = await getVoiceSettings(runtime);
      const { audio } = await Echogarden.synthesize(text, {
        engine: "vits",
        voice: vitsVoice
      });
      let wavStream;
      if (audio instanceof Buffer) {
        console.log("audio is a buffer");
        wavStream = Readable.from(audio);
      } else if ("audioChannels" in audio && "sampleRate" in audio) {
        console.log("audio is a RawAudio");
        const floatBuffer = Buffer.from(audio.audioChannels[0].buffer);
        console.log("buffer length: ", floatBuffer.length);
        const sampleRate = audio.sampleRate;
        const floatArray = new Float32Array(floatBuffer.buffer);
        const pcmBuffer = new Int16Array(floatArray.length);
        for (let i = 0; i < floatArray.length; i++) {
          pcmBuffer[i] = Math.round(floatArray[i] * 32767);
        }
        const wavHeaderBuffer = getWavHeader(
          pcmBuffer.length * 2,
          sampleRate,
          1,
          16
        );
        const wavBuffer = Buffer.concat([
          wavHeaderBuffer,
          Buffer.from(pcmBuffer.buffer)
        ]);
        wavStream = Readable.from(wavBuffer);
      } else {
        throw new Error("Unsupported audio format");
      }
      return wavStream;
    }
    throw error;
  }
}
async function processVitsAudio(audio) {
  let wavStream;
  if (audio instanceof Buffer) {
    console.log("audio is a buffer");
    wavStream = Readable.from(audio);
  } else if ("audioChannels" in audio && "sampleRate" in audio) {
    console.log("audio is a RawAudio");
    const floatBuffer = Buffer.from(audio.audioChannels[0].buffer);
    console.log("buffer length: ", floatBuffer.length);
    const sampleRate = audio.sampleRate;
    const floatArray = new Float32Array(floatBuffer.buffer);
    const pcmBuffer = new Int16Array(floatArray.length);
    for (let i = 0; i < floatArray.length; i++) {
      pcmBuffer[i] = Math.round(floatArray[i] * 32767);
    }
    const wavHeaderBuffer = getWavHeader(
      pcmBuffer.length * 2,
      sampleRate,
      1,
      16
    );
    const wavBuffer = Buffer.concat([
      wavHeaderBuffer,
      Buffer.from(pcmBuffer.buffer)
    ]);
    wavStream = Readable.from(wavBuffer);
  } else {
    throw new Error("Unsupported audio format");
  }
  return wavStream;
}
async function generateVitsAudio(runtime, text) {
  const { vitsVoice } = await getVoiceSettings(runtime);
  const { audio } = await Echogarden.synthesize(text, {
    engine: "vits",
    voice: vitsVoice
  });
  return processVitsAudio(audio);
}
var SpeechService = class _SpeechService extends Service5 {
  static serviceType = ServiceType5.SPEECH_GENERATION;
  async initialize(_runtime) {
  }
  getInstance() {
    return _SpeechService.getInstance();
  }
  async generate(runtime, text) {
    try {
      const { useVits } = await getVoiceSettings(runtime);
      if (useVits || !runtime.getSetting("ELEVENLABS_XI_API_KEY")) {
        return await generateVitsAudio(runtime, text);
      }
      return await textToSpeech(runtime, text);
    } catch (error) {
      console.error("Speech generation error:", error);
      return await generateVitsAudio(runtime, text);
    }
  }
};

// src/services/transcription.ts
import {
  elizaLogger as elizaLogger4,
  settings as settings2
} from "@ai16z/eliza";
import { Service as Service6, ServiceType as ServiceType6 } from "@ai16z/eliza";
import { exec } from "child_process";
import { File } from "formdata-node";
import fs3 from "fs";
import { nodewhisper } from "nodejs-whisper";
import os2 from "os";
import path3 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { promisify } from "util";

// ../../node_modules/@deepgram/sdk/dist/module/lib/errors.js
var DeepgramError = class extends Error {
  constructor(message) {
    super(message);
    this.__dgError = true;
    this.name = "DeepgramError";
  }
};
function isDeepgramError(error) {
  return typeof error === "object" && error !== null && "__dgError" in error;
}
var DeepgramApiError = class extends DeepgramError {
  constructor(message, status) {
    super(message);
    this.name = "DeepgramApiError";
    this.status = status;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status
    };
  }
};
var DeepgramUnknownError = class extends DeepgramError {
  constructor(message, originalError) {
    super(message);
    this.name = "DeepgramUnknownError";
    this.originalError = originalError;
  }
};
var DeepgramVersionError = class extends DeepgramError {
  constructor() {
    super(`You are attempting to use an old format for a newer SDK version. Read more here: https://dpgr.am/js-v3`);
    this.name = "DeepgramVersionError";
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/packages/AbstractClient.js
import { EventEmitter } from "events";

// ../../node_modules/@deepgram/sdk/dist/module/lib/helpers.js
var import_cross_fetch = __toESM(require_node_ponyfill());
var import_deepmerge = __toESM(require_cjs());
var isBrowser = () => BROWSER_AGENT !== "unknown";
var isNode = () => NODE_VERSION !== "unknown";
var isBun = () => BUN_VERSION !== "unknown";
function applyDefaults(options = {}, subordinate = {}) {
  return (0, import_deepmerge.default)(subordinate, options);
}
function appendSearchParams(searchParams, options) {
  Object.keys(options).forEach((i) => {
    if (Array.isArray(options[i])) {
      const arrayParams = options[i];
      arrayParams.forEach((param) => {
        searchParams.append(i, String(param));
      });
    } else {
      searchParams.append(i, String(options[i]));
    }
  });
}
var resolveHeadersConstructor = () => {
  if (typeof Headers === "undefined") {
    return import_cross_fetch.Headers;
  }
  return Headers;
};
var isUrlSource = (providedSource) => {
  if (providedSource.url)
    return true;
  return false;
};
var isTextSource = (providedSource) => {
  if (providedSource.text)
    return true;
  return false;
};
var isFileSource = (providedSource) => {
  if (isReadStreamSource(providedSource) || isBufferSource(providedSource))
    return true;
  return false;
};
var isBufferSource = (providedSource) => {
  if (providedSource)
    return true;
  return false;
};
var isReadStreamSource = (providedSource) => {
  if (providedSource)
    return true;
  return false;
};
var convertProtocolToWs = (url) => {
  const convert = (string) => string.toLowerCase().replace(/^http/, "ws");
  return convert(url);
};
var convertLegacyOptions = (optionsArg) => {
  var _a, _b, _c, _d, _e, _f;
  const newOptions = {};
  if (optionsArg._experimentalCustomFetch) {
    newOptions.global = {
      fetch: {
        client: optionsArg._experimentalCustomFetch
      }
    };
  }
  optionsArg = (0, import_deepmerge.default)(optionsArg, newOptions);
  if ((_a = optionsArg.restProxy) === null || _a === void 0 ? void 0 : _a.url) {
    newOptions.global = {
      fetch: {
        options: {
          proxy: {
            url: (_b = optionsArg.restProxy) === null || _b === void 0 ? void 0 : _b.url
          }
        }
      }
    };
  }
  optionsArg = (0, import_deepmerge.default)(optionsArg, newOptions);
  if ((_c = optionsArg.global) === null || _c === void 0 ? void 0 : _c.url) {
    newOptions.global = {
      fetch: {
        options: {
          url: optionsArg.global.url
        }
      },
      websocket: {
        options: {
          url: optionsArg.global.url
        }
      }
    };
  }
  optionsArg = (0, import_deepmerge.default)(optionsArg, newOptions);
  if ((_d = optionsArg.global) === null || _d === void 0 ? void 0 : _d.headers) {
    newOptions.global = {
      fetch: {
        options: {
          headers: (_e = optionsArg.global) === null || _e === void 0 ? void 0 : _e.headers
        }
      },
      websocket: {
        options: {
          _nodeOnlyHeaders: (_f = optionsArg.global) === null || _f === void 0 ? void 0 : _f.headers
        }
      }
    };
  }
  optionsArg = (0, import_deepmerge.default)(optionsArg, newOptions);
  return optionsArg;
};

// ../../node_modules/@deepgram/sdk/dist/module/lib/version.js
var version = "3.9.0";

// ../../node_modules/@deepgram/sdk/dist/module/lib/constants.js
var NODE_VERSION = typeof process !== "undefined" && process.versions && process.versions.node ? process.versions.node : "unknown";
var BUN_VERSION = typeof process !== "undefined" && process.versions && process.versions.bun ? process.versions.bun : "unknown";
var BROWSER_AGENT = typeof window !== "undefined" && window.navigator && window.navigator.userAgent ? window.navigator.userAgent : "unknown";
var getAgent = () => {
  if (isNode()) {
    return `node/${NODE_VERSION}`;
  } else if (isBun()) {
    return `bun/${BUN_VERSION}`;
  } else if (isBrowser()) {
    return `javascript ${BROWSER_AGENT}`;
  } else {
    return `unknown`;
  }
};
var DEFAULT_HEADERS = {
  "Content-Type": `application/json`,
  "X-Client-Info": `@deepgram/sdk; ${isBrowser() ? "browser" : "server"}; v${version}`,
  "User-Agent": `@deepgram/sdk/${version} ${getAgent()}`
};
var DEFAULT_URL = "https://api.deepgram.com";
var DEFAULT_GLOBAL_OPTIONS = {
  fetch: { options: { url: DEFAULT_URL, headers: DEFAULT_HEADERS } },
  websocket: {
    options: { url: convertProtocolToWs(DEFAULT_URL), _nodeOnlyHeaders: DEFAULT_HEADERS }
  }
};
var DEFAULT_OPTIONS = {
  global: DEFAULT_GLOBAL_OPTIONS
};
var SOCKET_STATES;
(function(SOCKET_STATES2) {
  SOCKET_STATES2[SOCKET_STATES2["connecting"] = 0] = "connecting";
  SOCKET_STATES2[SOCKET_STATES2["open"] = 1] = "open";
  SOCKET_STATES2[SOCKET_STATES2["closing"] = 2] = "closing";
  SOCKET_STATES2[SOCKET_STATES2["closed"] = 3] = "closed";
})(SOCKET_STATES || (SOCKET_STATES = {}));
var CONNECTION_STATE;
(function(CONNECTION_STATE2) {
  CONNECTION_STATE2["Connecting"] = "connecting";
  CONNECTION_STATE2["Open"] = "open";
  CONNECTION_STATE2["Closing"] = "closing";
  CONNECTION_STATE2["Closed"] = "closed";
})(CONNECTION_STATE || (CONNECTION_STATE = {}));

// ../../node_modules/@deepgram/sdk/dist/module/packages/AbstractClient.js
var noop = () => {
};
var AbstractClient = class extends EventEmitter {
  /**
   * Constructs a new instance of the DeepgramClient class with the provided options.
   *
   * @param options - The options to configure the DeepgramClient instance.
   * @param options.key - The Deepgram API key to use for authentication. If not provided, the `DEEPGRAM_API_KEY` environment variable will be used.
   * @param options.global - Global options that apply to all requests made by the DeepgramClient instance.
   * @param options.global.fetch - Options to configure the fetch requests made by the DeepgramClient instance.
   * @param options.global.fetch.options - Additional options to pass to the fetch function, such as `url` and `headers`.
   * @param options.namespace - Options specific to a particular namespace within the DeepgramClient instance.
   */
  constructor(options) {
    super();
    this.factory = void 0;
    this.namespace = "global";
    this.version = "v1";
    this.baseUrl = DEFAULT_URL;
    this.logger = noop;
    let key;
    if (typeof options.key === "function") {
      this.factory = options.key;
      key = this.factory();
    } else {
      key = options.key;
    }
    if (!key) {
      key = process.env.DEEPGRAM_API_KEY;
    }
    if (!key) {
      throw new DeepgramError("A deepgram API key is required.");
    }
    this.key = key;
    options = convertLegacyOptions(options);
    this.options = applyDefaults(options, DEFAULT_OPTIONS);
  }
  /**
   * Sets the version for the current instance of the Deepgram API and returns the instance.
   *
   * @param version - The version to set for the Deepgram API instance. Defaults to "v1" if not provided.
   * @returns The current instance of the AbstractClient with the updated version.
   */
  v(version2 = "v1") {
    this.version = version2;
    return this;
  }
  /**
   * Gets the namespace options for the current instance of the AbstractClient.
   * The namespace options include the default options merged with the global options,
   * and the API key for the current instance.
   *
   * @returns The namespace options for the current instance.
   */
  get namespaceOptions() {
    const defaults = applyDefaults(this.options[this.namespace], this.options.global);
    return Object.assign(Object.assign({}, defaults), { key: this.key });
  }
  /**
   * Generates a URL for an API endpoint with optional query parameters and transcription options.
   *
   * @param endpoint - The API endpoint URL, which may contain placeholders for fields.
   * @param fields - An optional object containing key-value pairs to replace placeholders in the endpoint URL.
   * @param transcriptionOptions - Optional transcription options to include as query parameters in the URL.
   * @returns A URL object representing the constructed API request URL.
   */
  getRequestUrl(endpoint, fields = { version: this.version }, transcriptionOptions) {
    fields.version = this.version;
    endpoint = endpoint.replace(/:(\w+)/g, function(_, key) {
      return fields[key];
    });
    const url = new URL(endpoint, this.baseUrl);
    if (transcriptionOptions) {
      appendSearchParams(url.searchParams, transcriptionOptions);
    }
    return url;
  }
  /**
   * Logs the message.
   *
   * For customized logging, `this.logger` can be overridden.
   */
  log(kind, msg, data) {
    this.logger(kind, msg, data);
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/packages/AbstractLiveClient.js
var __awaiter = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var NATIVE_WEBSOCKET_AVAILABLE = typeof WebSocket !== "undefined";
var AbstractLiveClient = class extends AbstractClient {
  constructor(options) {
    super(options);
    this.conn = null;
    this.sendBuffer = [];
    this.reconnect = noop;
    const { key, websocket: { options: websocketOptions, client } } = this.namespaceOptions;
    if (this.proxy) {
      this.baseUrl = websocketOptions.proxy.url;
    } else {
      this.baseUrl = websocketOptions.url;
    }
    if (client) {
      this.transport = client;
    } else {
      this.transport = null;
    }
    if (websocketOptions._nodeOnlyHeaders) {
      this.headers = websocketOptions._nodeOnlyHeaders;
    } else {
      this.headers = {};
    }
    if (!("Authorization" in this.headers)) {
      this.headers["Authorization"] = `Token ${key}`;
    }
  }
  /**
   * Connects the socket, unless already connected.
   *
   * @protected Can only be called from within the class.
   */
  connect(transcriptionOptions, endpoint) {
    if (this.conn) {
      return;
    }
    this.reconnect = (options = transcriptionOptions) => {
      this.connect(options, endpoint);
    };
    const requestUrl = this.getRequestUrl(endpoint, {}, transcriptionOptions);
    if (this.transport) {
      this.conn = new this.transport(requestUrl, void 0, {
        headers: this.headers
      });
      return;
    }
    if (isBun()) {
      import("./wrapper-IANJ3KLP.js").then(({ default: WS }) => {
        this.conn = new WS(requestUrl, {
          headers: this.headers
        });
        console.log(`Using WS package`);
        this.setupConnection();
      });
      return;
    }
    if (NATIVE_WEBSOCKET_AVAILABLE) {
      this.conn = new WebSocket(requestUrl, ["token", this.namespaceOptions.key]);
      this.setupConnection();
      return;
    }
    this.conn = new WSWebSocketDummy(requestUrl, void 0, {
      close: () => {
        this.conn = null;
      }
    });
    import("./wrapper-IANJ3KLP.js").then(({ default: WS }) => {
      this.conn = new WS(requestUrl, void 0, {
        headers: this.headers
      });
      this.setupConnection();
    });
  }
  /**
   * Disconnects the socket from the client.
   *
   * @param code A numeric status code to send on disconnect.
   * @param reason A custom reason for the disconnect.
   */
  disconnect(code, reason) {
    if (this.conn) {
      this.conn.onclose = function() {
      };
      if (code) {
        this.conn.close(code, reason !== null && reason !== void 0 ? reason : "");
      } else {
        this.conn.close();
      }
      this.conn = null;
    }
  }
  /**
   * Returns the current connection state of the WebSocket connection.
   *
   * @returns The current connection state of the WebSocket connection.
   */
  connectionState() {
    switch (this.conn && this.conn.readyState) {
      case SOCKET_STATES.connecting:
        return CONNECTION_STATE.Connecting;
      case SOCKET_STATES.open:
        return CONNECTION_STATE.Open;
      case SOCKET_STATES.closing:
        return CONNECTION_STATE.Closing;
      default:
        return CONNECTION_STATE.Closed;
    }
  }
  /**
   * Returns the current ready state of the WebSocket connection.
   *
   * @returns The current ready state of the WebSocket connection.
   */
  getReadyState() {
    var _a, _b;
    return (_b = (_a = this.conn) === null || _a === void 0 ? void 0 : _a.readyState) !== null && _b !== void 0 ? _b : SOCKET_STATES.closed;
  }
  /**
   * Returns `true` is the connection is open.
   */
  isConnected() {
    return this.connectionState() === CONNECTION_STATE.Open;
  }
  /**
   * Sends data to the Deepgram API via websocket connection
   * @param data Audio data to send to Deepgram
   *
   * Conforms to RFC #146 for Node.js - does not send an empty byte.
   * @see https://github.com/deepgram/deepgram-python-sdk/issues/146
   */
  send(data) {
    const callback = () => __awaiter(this, void 0, void 0, function* () {
      var _a;
      if (data instanceof Blob) {
        if (data.size === 0) {
          this.log("warn", "skipping `send` for zero-byte blob", data);
          return;
        }
        data = yield data.arrayBuffer();
      }
      if (typeof data !== "string") {
        if (data.byteLength === 0) {
          this.log("warn", "skipping `send` for zero-byte blob", data);
          return;
        }
      }
      (_a = this.conn) === null || _a === void 0 ? void 0 : _a.send(data);
    });
    if (this.isConnected()) {
      callback();
    } else {
      this.sendBuffer.push(callback);
    }
  }
  /**
   * Determines whether the current instance should proxy requests.
   * @returns {boolean} true if the current instance should proxy requests; otherwise, false
   */
  get proxy() {
    var _a;
    return this.key === "proxy" && !!((_a = this.namespaceOptions.websocket.options.proxy) === null || _a === void 0 ? void 0 : _a.url);
  }
};
var WSWebSocketDummy = class {
  constructor(address, _protocols, options) {
    this.binaryType = "arraybuffer";
    this.onclose = () => {
    };
    this.onerror = () => {
    };
    this.onmessage = () => {
    };
    this.onopen = () => {
    };
    this.readyState = SOCKET_STATES.connecting;
    this.send = () => {
    };
    this.url = null;
    this.url = address.toString();
    this.close = options.close;
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/lib/fetch.js
var import_cross_fetch2 = __toESM(require_node_ponyfill());
var __awaiter2 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var resolveFetch = (customFetch) => {
  let _fetch;
  if (customFetch) {
    _fetch = customFetch;
  } else if (typeof fetch === "undefined") {
    _fetch = import_cross_fetch2.default;
  } else {
    _fetch = fetch;
  }
  return (...args) => _fetch(...args);
};
var fetchWithAuth = (apiKey, customFetch) => {
  const fetch2 = resolveFetch(customFetch);
  const HeadersConstructor = resolveHeadersConstructor();
  return (input, init) => __awaiter2(void 0, void 0, void 0, function* () {
    const headers = new HeadersConstructor(init === null || init === void 0 ? void 0 : init.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Token ${apiKey}`);
    }
    return fetch2(input, Object.assign(Object.assign({}, init), { headers }));
  });
};
var resolveResponse = () => __awaiter2(void 0, void 0, void 0, function* () {
  if (typeof Response === "undefined") {
    return (yield import("./node-ponyfill-6CWO4LLV.js")).Response;
  }
  return Response;
});

// ../../node_modules/@deepgram/sdk/dist/module/packages/AbstractRestClient.js
var import_deepmerge2 = __toESM(require_cjs());
var __awaiter3 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var AbstractRestClient = class extends AbstractClient {
  /**
   * Constructs a new instance of the `AbstractRestClient` class with the provided options.
   *
   * @param options - The client options to use for this instance.
   * @throws {DeepgramError} If the client is being used in a browser and no proxy is provided.
   */
  constructor(options) {
    super(options);
    if (isBrowser() && !this.proxy) {
      throw new DeepgramError("Due to CORS we are unable to support REST-based API calls to our API from the browser. Please consider using a proxy: https://dpgr.am/js-proxy for more information.");
    }
    this.fetch = fetchWithAuth(this.key, this.namespaceOptions.fetch.client);
    if (this.proxy) {
      this.baseUrl = this.namespaceOptions.fetch.options.proxy.url;
    } else {
      this.baseUrl = this.namespaceOptions.fetch.options.url;
    }
  }
  /**
   * Constructs an error message from the provided error object.
   *
   * @param err - The error object to extract the error message from.
   * @returns The constructed error message.
   */
  _getErrorMessage(err) {
    return err.msg || err.message || err.error_description || err.error || JSON.stringify(err);
  }
  /**
   * Handles an error that occurred during a request.
   *
   * @param error - The error that occurred during the request.
   * @param reject - The rejection function to call with the error.
   * @returns A Promise that resolves when the error has been handled.
   */
  _handleError(error, reject) {
    return __awaiter3(this, void 0, void 0, function* () {
      const Res = yield resolveResponse();
      if (error instanceof Res) {
        error.json().then((err) => {
          reject(new DeepgramApiError(this._getErrorMessage(err), error.status || 500));
        }).catch((err) => {
          reject(new DeepgramUnknownError(this._getErrorMessage(err), err));
        });
      } else {
        reject(new DeepgramUnknownError(this._getErrorMessage(error), error));
      }
    });
  }
  /**
   * Constructs the options object to be used for a fetch request.
   *
   * @param method - The HTTP method to use for the request, such as "GET", "POST", "PUT", "PATCH", or "DELETE".
   * @param bodyOrOptions - For "POST", "PUT", and "PATCH" requests, the request body as a string, Buffer, or Readable stream. For "GET" and "DELETE" requests, the fetch options to use.
   * @param options - Additional fetch options to use for the request.
   * @returns The constructed fetch options object.
   */
  _getRequestOptions(method, bodyOrOptions, options) {
    let reqOptions = { method };
    if (method === "GET" || method === "DELETE") {
      reqOptions = Object.assign(Object.assign({}, reqOptions), bodyOrOptions);
    } else {
      reqOptions = Object.assign(Object.assign({ duplex: "half", body: bodyOrOptions }, reqOptions), options);
    }
    return (0, import_deepmerge2.default)(this.namespaceOptions.fetch.options, reqOptions, { clone: false });
  }
  _handleRequest(method, url, bodyOrOptions, options) {
    return __awaiter3(this, void 0, void 0, function* () {
      return new Promise((resolve, reject) => {
        const fetcher = this.fetch;
        fetcher(url, this._getRequestOptions(method, bodyOrOptions, options)).then((result) => {
          if (!result.ok)
            throw result;
          resolve(result);
        }).catch((error) => this._handleError(error, reject));
      });
    });
  }
  /**
   * Handles an HTTP GET request using the provided URL and optional request options.
   *
   * @param url - The URL to send the GET request to.
   * @param options - Additional fetch options to use for the GET request.
   * @returns A Promise that resolves to the Response object for the GET request.
   */
  get(url, options) {
    return __awaiter3(this, void 0, void 0, function* () {
      return this._handleRequest("GET", url, options);
    });
  }
  /**
   * Handles an HTTP POST request using the provided URL, request body, and optional request options.
   *
   * @param url - The URL to send the POST request to.
   * @param body - The request body as a string, Buffer, or Readable stream.
   * @param options - Additional fetch options to use for the POST request.
   * @returns A Promise that resolves to the Response object for the POST request.
   */
  post(url, body, options) {
    return __awaiter3(this, void 0, void 0, function* () {
      return this._handleRequest("POST", url, body, options);
    });
  }
  /**
   * Handles an HTTP PUT request using the provided URL, request body, and optional request options.
   *
   * @param url - The URL to send the PUT request to.
   * @param body - The request body as a string, Buffer, or Readable stream.
   * @param options - Additional fetch options to use for the PUT request.
   * @returns A Promise that resolves to the Response object for the PUT request.
   */
  put(url, body, options) {
    return __awaiter3(this, void 0, void 0, function* () {
      return this._handleRequest("PUT", url, body, options);
    });
  }
  /**
   * Handles an HTTP PATCH request using the provided URL, request body, and optional request options.
   *
   * @param url - The URL to send the PATCH request to.
   * @param body - The request body as a string, Buffer, or Readable stream.
   * @param options - Additional fetch options to use for the PATCH request.
   * @returns A Promise that resolves to the Response object for the PATCH request.
   */
  patch(url, body, options) {
    return __awaiter3(this, void 0, void 0, function* () {
      return this._handleRequest("PATCH", url, body, options);
    });
  }
  /**
   * Handles an HTTP DELETE request using the provided URL and optional request options.
   *
   * @param url - The URL to send the DELETE request to.
   * @param options - Additional fetch options to use for the DELETE request.
   * @returns A Promise that resolves to the Response object for the DELETE request.
   */
  delete(url, options) {
    return __awaiter3(this, void 0, void 0, function* () {
      return this._handleRequest("DELETE", url, options);
    });
  }
  /**
   * Determines whether the current instance should proxy requests.
   * @returns {boolean} true if the current instance should proxy requests; otherwise, false
   */
  get proxy() {
    var _a;
    return this.key === "proxy" && !!((_a = this.namespaceOptions.fetch.options.proxy) === null || _a === void 0 ? void 0 : _a.url);
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/lib/enums/LiveTranscriptionEvents.js
var LiveTranscriptionEvents;
(function(LiveTranscriptionEvents2) {
  LiveTranscriptionEvents2["Open"] = "open";
  LiveTranscriptionEvents2["Close"] = "close";
  LiveTranscriptionEvents2["Error"] = "error";
  LiveTranscriptionEvents2["Transcript"] = "Results";
  LiveTranscriptionEvents2["Metadata"] = "Metadata";
  LiveTranscriptionEvents2["UtteranceEnd"] = "UtteranceEnd";
  LiveTranscriptionEvents2["SpeechStarted"] = "SpeechStarted";
  LiveTranscriptionEvents2["Unhandled"] = "Unhandled";
})(LiveTranscriptionEvents || (LiveTranscriptionEvents = {}));

// ../../node_modules/@deepgram/sdk/dist/module/lib/enums/LiveTTSEvents.js
var LiveTTSEvents;
(function(LiveTTSEvents2) {
  LiveTTSEvents2["Open"] = "Open";
  LiveTTSEvents2["Close"] = "Close";
  LiveTTSEvents2["Error"] = "Error";
  LiveTTSEvents2["Metadata"] = "Metadata";
  LiveTTSEvents2["Flushed"] = "Flushed";
  LiveTTSEvents2["Warning"] = "Warning";
  LiveTTSEvents2["Audio"] = "Audio";
  LiveTTSEvents2["Unhandled"] = "Unhandled";
})(LiveTTSEvents || (LiveTTSEvents = {}));

// ../../node_modules/@deepgram/sdk/dist/module/packages/ListenLiveClient.js
var ListenLiveClient = class extends AbstractLiveClient {
  /**
   * Constructs a new `ListenLiveClient` instance with the provided options.
   *
   * @param options - The `DeepgramClientOptions` to use for the client connection.
   * @param transcriptionOptions - An optional `LiveSchema` object containing additional configuration options for the live transcription.
   * @param endpoint - An optional string representing the WebSocket endpoint to connect to. Defaults to `:version/listen`.
   */
  constructor(options, transcriptionOptions = {}, endpoint = ":version/listen") {
    super(options);
    this.namespace = "listen";
    this.connect(transcriptionOptions, endpoint);
  }
  /**
   * Sets up the connection event handlers.
   * This method is responsible for handling the various events that can occur on the WebSocket connection, such as opening, closing, and receiving messages.
   * - When the connection is opened, it emits the `LiveTranscriptionEvents.Open` event.
   * - When the connection is closed, it emits the `LiveTranscriptionEvents.Close` event.
   * - When an error occurs on the connection, it emits the `LiveTranscriptionEvents.Error` event.
   * - When a message is received, it parses the message and emits the appropriate event based on the message type, such as `LiveTranscriptionEvents.Metadata`, `LiveTranscriptionEvents.Transcript`, `LiveTranscriptionEvents.UtteranceEnd`, and `LiveTranscriptionEvents.SpeechStarted`.
   */
  setupConnection() {
    if (this.conn) {
      this.conn.onopen = () => {
        this.emit(LiveTranscriptionEvents.Open, this);
      };
      this.conn.onclose = (event) => {
        this.emit(LiveTranscriptionEvents.Close, event);
      };
      this.conn.onerror = (event) => {
        this.emit(LiveTranscriptionEvents.Error, event);
      };
      this.conn.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data.toString());
          if (data.type === LiveTranscriptionEvents.Metadata) {
            this.emit(LiveTranscriptionEvents.Metadata, data);
          } else if (data.type === LiveTranscriptionEvents.Transcript) {
            this.emit(LiveTranscriptionEvents.Transcript, data);
          } else if (data.type === LiveTranscriptionEvents.UtteranceEnd) {
            this.emit(LiveTranscriptionEvents.UtteranceEnd, data);
          } else if (data.type === LiveTranscriptionEvents.SpeechStarted) {
            this.emit(LiveTranscriptionEvents.SpeechStarted, data);
          } else {
            this.emit(LiveTranscriptionEvents.Unhandled, data);
          }
        } catch (error) {
          this.emit(LiveTranscriptionEvents.Error, {
            event,
            message: "Unable to parse `data` as JSON.",
            error
          });
        }
      };
    }
  }
  /**
   * Sends additional config to the connected session.
   *
   * @param config - The configuration options to apply to the LiveClient.
   * @param config.numerals - We currently only support numerals.
   */
  configure(config) {
    this.send(JSON.stringify({
      type: "Configure",
      processors: config
    }));
  }
  /**
   * Sends a "KeepAlive" message to the server to maintain the connection.
   */
  keepAlive() {
    this.send(JSON.stringify({
      type: "KeepAlive"
    }));
  }
  /**
   * Sends a "Finalize" message to flush any transcription sitting in the server's buffer.
   */
  finalize() {
    this.send(JSON.stringify({
      type: "Finalize"
    }));
  }
  /**
   * @deprecated Since version 3.4. Will be removed in version 4.0. Use `requestClose` instead.
   */
  finish() {
    this.requestClose();
  }
  /**
   * Requests the server close the connection.
   */
  requestClose() {
    this.send(JSON.stringify({
      type: "CloseStream"
    }));
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/packages/ListenRestClient.js
var __awaiter4 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var ListenRestClient = class extends AbstractRestClient {
  constructor() {
    super(...arguments);
    this.namespace = "listen";
  }
  /**
   * Transcribes audio from a URL synchronously.
   *
   * @param source - The URL source object containing the audio URL to transcribe.
   * @param options - An optional `PrerecordedSchema` object containing additional options for the transcription.
   * @param endpoint - An optional endpoint string to use for the transcription request.
   * @returns A `DeepgramResponse` object containing the transcription result or an error.
   */
  transcribeUrl(source, options, endpoint = ":version/listen") {
    return __awaiter4(this, void 0, void 0, function* () {
      try {
        let body;
        if (isUrlSource(source)) {
          body = JSON.stringify(source);
        } else {
          throw new DeepgramError("Unknown transcription source type");
        }
        if (options !== void 0 && "callback" in options) {
          throw new DeepgramError("Callback cannot be provided as an option to a synchronous transcription. Use `transcribeUrlCallback` or `transcribeFileCallback` instead.");
        }
        const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign({}, options));
        const result = yield this.post(requestUrl, body).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Transcribes audio from a file asynchronously.
   *
   * @param source - The file source object containing the audio file to transcribe.
   * @param options - An optional `PrerecordedSchema` object containing additional options for the transcription.
   * @param endpoint - An optional endpoint string to use for the transcription request.
   * @returns A `DeepgramResponse` object containing the transcription result or an error.
   */
  transcribeFile(source, options, endpoint = ":version/listen") {
    return __awaiter4(this, void 0, void 0, function* () {
      try {
        let body;
        if (isFileSource(source)) {
          body = source;
        } else {
          throw new DeepgramError("Unknown transcription source type");
        }
        if (options !== void 0 && "callback" in options) {
          throw new DeepgramError("Callback cannot be provided as an option to a synchronous transcription. Use `transcribeUrlCallback` or `transcribeFileCallback` instead.");
        }
        const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign({}, options));
        const result = yield this.post(requestUrl, body, {
          headers: { "Content-Type": "deepgram/audio+video" }
        }).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Transcribes audio from a URL asynchronously.
   *
   * @param source - The URL source object containing the audio file to transcribe.
   * @param callback - The callback URL to receive the transcription result.
   * @param options - An optional `PrerecordedSchema` object containing additional options for the transcription.
   * @param endpoint - An optional endpoint string to use for the transcription request.
   * @returns A `DeepgramResponse` object containing the transcription result or an error.
   */
  transcribeUrlCallback(source, callback, options, endpoint = ":version/listen") {
    return __awaiter4(this, void 0, void 0, function* () {
      try {
        let body;
        if (isUrlSource(source)) {
          body = JSON.stringify(source);
        } else {
          throw new DeepgramError("Unknown transcription source type");
        }
        const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign(Object.assign({}, options), { callback: callback.toString() }));
        const result = yield this.post(requestUrl, body).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Transcribes audio from a file asynchronously.
   *
   * @param source - The file source object containing the audio file to transcribe.
   * @param callback - The callback URL to receive the transcription result.
   * @param options - An optional `PrerecordedSchema` object containing additional options for the transcription.
   * @param endpoint - An optional endpoint string to use for the transcription request.
   * @returns A `DeepgramResponse` object containing the transcription result or an error.
   */
  transcribeFileCallback(source, callback, options, endpoint = ":version/listen") {
    return __awaiter4(this, void 0, void 0, function* () {
      try {
        let body;
        if (isFileSource(source)) {
          body = source;
        } else {
          throw new DeepgramError("Unknown transcription source type");
        }
        const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign(Object.assign({}, options), { callback: callback.toString() }));
        const result = yield this.post(requestUrl, body, {
          headers: { "Content-Type": "deepgram/audio+video" }
        }).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/packages/ListenClient.js
var ListenClient = class extends AbstractClient {
  constructor() {
    super(...arguments);
    this.namespace = "listen";
  }
  /**
   * Returns a `ListenRestClient` instance for interacting with the prerecorded listen API.
   */
  get prerecorded() {
    return new ListenRestClient(this.options);
  }
  /**
   * Returns a `ListenLiveClient` instance for interacting with the live listen API, with the provided transcription options and endpoint.
   * @param {LiveSchema} [transcriptionOptions={}] - The transcription options to use for the live listen API.
   * @param {string} [endpoint=":version/listen"] - The endpoint to use for the live listen API.
   * @returns {ListenLiveClient} - A `ListenLiveClient` instance for interacting with the live listen API.
   */
  live(transcriptionOptions = {}, endpoint = ":version/listen") {
    return new ListenLiveClient(this.options, transcriptionOptions, endpoint);
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/packages/ManageRestClient.js
var __awaiter5 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var ManageRestClient = class extends AbstractRestClient {
  constructor() {
    super(...arguments);
    this.namespace = "manage";
  }
  /**
   * Retrieves the details of the current authentication token.
   *
   * @returns A promise that resolves to an object containing the token details, or an error object if an error occurs.
   * @see https://developers.deepgram.com/docs/authenticating#test-request
   */
  getTokenDetails(endpoint = ":version/auth/token") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint);
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves a list of all projects associated with the authenticated user.
   *
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects".
   * @returns A promise that resolves to an object containing the list of projects, or an error object if an error occurs.
   * @see https://developers.deepgram.com/reference/get-projects
   */
  getProjects(endpoint = ":version/projects") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint);
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves the details of a specific project associated with the authenticated user.
   *
   * @param projectId - The ID of the project to retrieve.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId".
   * @returns A promise that resolves to an object containing the project details, or an error object if an error occurs.
   * @see https://developers.deepgram.com/reference/get-project
   */
  getProject(projectId, endpoint = ":version/projects/:projectId") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Updates an existing project associated with the authenticated user.
   *
   * @param projectId - The ID of the project to update.
   * @param options - An object containing the updated project details.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId".
   * @returns A promise that resolves to an object containing the response message, or an error object if an error occurs.
   * @see https://developers.deepgram.com/reference/update-project
   */
  updateProject(projectId, options, endpoint = ":version/projects/:projectId") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
        const body = JSON.stringify(options);
        const result = yield this.patch(requestUrl, body).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Deletes an existing project associated with the authenticated user.
   *
   * @param projectId - The ID of the project to delete.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId".
   * @returns A promise that resolves to an object containing the response message, or an error object if an error occurs.
   * @see https://developers.deepgram.com/reference/delete-project
   */
  deleteProject(projectId, endpoint = ":version/projects/:projectId") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId });
        yield this.delete(requestUrl);
        return { error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves a list of project keys associated with the specified project.
   *
   * @param projectId - The ID of the project to retrieve the keys for.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/keys".
   * @returns A promise that resolves to an object containing the list of project keys, or an error object if an error occurs.
   * @see https://developers.deepgram.com/reference/list-keys
   */
  getProjectKeys(projectId, endpoint = ":version/projects/:projectId/keys") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves a specific project key associated with the specified project.
   *
   * @param projectId - The ID of the project to retrieve the key for.
   * @param keyId - The ID of the project key to retrieve.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/keys/:keyId".
   * @returns A promise that resolves to an object containing the project key, or an error object if an error occurs.
   * @see https://developers.deepgram.com/reference/get-key
   */
  getProjectKey(projectId, keyId, endpoint = ":version/projects/:projectId/keys/:keyId") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId, keyId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Creates a new project key for the specified project.
   *
   * @param projectId - The ID of the project to create the key for.
   * @param options - An object containing the options for creating the project key.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/keys".
   * @returns A promise that resolves to an object containing the created project key, or an error object if an error occurs.
   * @see https://developers.deepgram.com/reference/create-key
   */
  createProjectKey(projectId, options, endpoint = ":version/projects/:projectId/keys") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
        const body = JSON.stringify(options);
        const result = yield this.post(requestUrl, body).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Deletes the specified project key.
   *
   * @param projectId - The ID of the project the key belongs to.
   * @param keyId - The ID of the key to delete.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/keys/:keyId".
   * @returns A promise that resolves to an object containing a null result and an error object if an error occurs.
   * @see https://developers.deepgram.com/reference/delete-key
   */
  deleteProjectKey(projectId, keyId, endpoint = ":version/projects/:projectId/keys/:keyId") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId, keyId });
        yield this.delete(requestUrl);
        return { error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves the members of the specified project.
   *
   * @param projectId - The ID of the project to retrieve members for.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/members".
   * @returns A promise that resolves to an object containing the project members and an error object if an error occurs.
   * @see https://developers.deepgram.com/reference/get-members
   */
  getProjectMembers(projectId, endpoint = ":version/projects/:projectId/members") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Removes a member from the specified project.
   *
   * @param projectId - The ID of the project to remove the member from.
   * @param memberId - The ID of the member to remove.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/members/:memberId".
   * @returns A promise that resolves to an object containing a null error if the operation was successful, or an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/remove-member
   */
  removeProjectMember(projectId, memberId, endpoint = ":version/projects/:projectId/members/:memberId") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId, memberId });
        yield this.delete(requestUrl);
        return { error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves the scopes for the specified project member.
   *
   * @param projectId - The ID of the project to retrieve the member scopes for.
   * @param memberId - The ID of the member to retrieve the scopes for.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/members/:memberId/scopes".
   * @returns A promise that resolves to an object containing the retrieved scopes or an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/get-member-scopes
   */
  getProjectMemberScopes(projectId, memberId, endpoint = ":version/projects/:projectId/members/:memberId/scopes") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId, memberId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Updates the scopes for the specified project member.
   *
   * @param projectId - The ID of the project to update the member scopes for.
   * @param memberId - The ID of the member to update the scopes for.
   * @param options - An object containing the new scopes to apply to the member.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/members/:memberId/scopes".
   * @returns A promise that resolves to an object containing the result of the update operation or an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/update-scope
   */
  updateProjectMemberScope(projectId, memberId, options, endpoint = ":version/projects/:projectId/members/:memberId/scopes") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId, memberId }, options);
        const body = JSON.stringify(options);
        const result = yield this.put(requestUrl, body).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves the project invites for the specified project.
   *
   * @param projectId - The ID of the project to retrieve the invites for.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/invites".
   * @returns A promise that resolves to an object containing the result of the get operation or an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/list-invites
   */
  getProjectInvites(projectId, endpoint = ":version/projects/:projectId/invites") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Sends a project invite to the specified email addresses.
   *
   * @param projectId - The ID of the project to send the invite for.
   * @param options - An object containing the email addresses to invite and any additional options.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/invites".
   * @returns A promise that resolves to an object containing the result of the post operation or an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/send-invites
   */
  sendProjectInvite(projectId, options, endpoint = ":version/projects/:projectId/invites") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
        const body = JSON.stringify(options);
        const result = yield this.post(requestUrl, body).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Deletes a project invite for the specified email address.
   *
   * @param projectId - The ID of the project to delete the invite for.
   * @param email - The email address of the invite to delete.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/invites/:email".
   * @returns A promise that resolves to an object containing a null result and an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/delete-invite
   */
  deleteProjectInvite(projectId, email, endpoint = ":version/projects/:projectId/invites/:email") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId, email });
        yield this.delete(requestUrl).then((result) => result.json());
        return { error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { error };
        }
        throw error;
      }
    });
  }
  /**
   * Leaves the specified project.
   *
   * @param projectId - The ID of the project to leave.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/leave".
   * @returns A promise that resolves to an object containing a null result and an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/leave-project
   */
  leaveProject(projectId, endpoint = ":version/projects/:projectId/leave") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId });
        const result = yield this.delete(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves a list of usage requests for the specified project.
   *
   * @param projectId - The ID of the project to retrieve usage requests for.
   * @param options - An object containing options to filter the usage requests, such as pagination parameters.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/requests".
   * @returns A promise that resolves to an object containing the list of usage requests and an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/get-all-requests
   */
  getProjectUsageRequests(projectId, options, endpoint = ":version/projects/:projectId/requests") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves the details of a specific usage request for the specified project.
   *
   * @param projectId - The ID of the project to retrieve the usage request for.
   * @param requestId - The ID of the usage request to retrieve.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/requests/:requestId".
   * @returns A promise that resolves to an object containing the usage request details and an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/get-request
   */
  getProjectUsageRequest(projectId, requestId, endpoint = ":version/projects/:projectId/requests/:requestId") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId, requestId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves the usage summary for the specified project.
   *
   * @param projectId - The ID of the project to retrieve the usage summary for.
   * @param options - An object containing optional parameters for the request, such as filters and pagination options.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/usage".
   * @returns A promise that resolves to an object containing the usage summary and an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/get-usage
   */
  getProjectUsageSummary(projectId, options, endpoint = ":version/projects/:projectId/usage") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves the usage fields for the specified project.
   *
   * @param projectId - The ID of the project to retrieve the usage fields for.
   * @param options - An object containing optional parameters for the request, such as filters and pagination options.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/usage/fields".
   * @returns A promise that resolves to an object containing the usage fields and an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/get-fields
   */
  getProjectUsageFields(projectId, options, endpoint = ":version/projects/:projectId/usage/fields") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves the balances for the specified project.
   *
   * @param projectId - The ID of the project to retrieve the balances for.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/balances".
   * @returns A promise that resolves to an object containing the project balances and an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/get-all-balances
   */
  getProjectBalances(projectId, endpoint = ":version/projects/:projectId/balances") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves the balance for the specified project and balance ID.
   *
   * @param projectId - The ID of the project to retrieve the balance for.
   * @param balanceId - The ID of the balance to retrieve.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/balances/:balanceId".
   * @returns A promise that resolves to an object containing the project balance and an error object if an error occurred.
   * @see https://developers.deepgram.com/reference/get-balance
   */
  getProjectBalance(projectId, balanceId, endpoint = ":version/projects/:projectId/balances/:balanceId") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId, balanceId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves all models for a given project.
   *
   * @param projectId - The ID of the project.
   * @param endpoint - (optional) The endpoint URL for retrieving models. Defaults to ":version/projects/:projectId/models".
   * @returns A promise that resolves to a DeepgramResponse containing the GetModelsResponse.
   * @example
   * ```typescript
   * import { createClient } from "@deepgram/sdk";
   *
   * const deepgram = createClient(DEEPGRAM_API_KEY);
   * const { result: models, error } = deepgram.manage.getAllModels("projectId");
   *
   * if (error) {
   *   console.error(error);
   * } else {
   *   console.log(models);
   * }
   * ```
   */
  getAllModels(projectId, options = {}, endpoint = ":version/projects/:projectId/models") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves a model from the specified project.
   *
   * @param projectId - The ID of the project.
   * @param modelId - The ID of the model.
   * @param endpoint - (optional) The endpoint URL for the request. Default value is ":version/projects/:projectId/models/:modelId".
   * @returns A promise that resolves to a DeepgramResponse containing the GetModelResponse.
   * @example
   * ```typescript
   * import { createClient } from "@deepgram/sdk";
   *
   * const deepgram = createClient(DEEPGRAM_API_KEY);
   * const { result: model, error } = deepgram.models.getModel("projectId", "modelId");
   *
   * if (error) {
   *   console.error(error);
   * } else {
   *   console.log(model);
   * }
   * ```
   */
  getModel(projectId, modelId, endpoint = ":version/projects/:projectId/models/:modelId") {
    return __awaiter5(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId, modelId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/packages/ModelsRestClient.js
var __awaiter6 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var ModelsRestClient = class extends AbstractRestClient {
  constructor() {
    super(...arguments);
    this.namespace = "models";
  }
  /**
   * Retrieves a list of all available models.
   *
   * @param endpoint - (optional) The endpoint to request.
   * @returns A promise that resolves with the response from the Deepgram API.
   * @example
   * ```typescript
   * import { createClient } from "@deepgram/sdk";
   *
   * const deepgram = createClient(DEEPGRAM_API_KEY);
   * const { result: models, error } = deepgram.models.getAll();
   *
   * if (error) {
   *   console.error(error);
   * } else {
   *   console.log(models);
   * }
   * ```
   */
  getAll(endpoint = ":version/models", options = {}) {
    return __awaiter6(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, {}, options);
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves information about a specific model.
   *
   * @param modelId - The UUID of the model to retrieve.
   * @param endpoint - (optional) The endpoint to request.
   * @returns A promise that resolves with the response from the Deepgram API.
   * @example
   * ```typescript
   * import { createClient } from "@deepgram/sdk";
   *
   * const deepgram = createClient(DEEPGRAM_API_KEY);
   * const { result: model, error } = deepgram.models.getModel("modelId");
   *
   * if (error) {
   *   console.error(error);
   * } else {
   *   console.log(model);
   * }
   * ```
   */
  getModel(modelId, endpoint = ":version/models/:modelId") {
    return __awaiter6(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { modelId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/packages/ReadRestClient.js
var __awaiter7 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var ReadRestClient = class extends AbstractRestClient {
  constructor() {
    super(...arguments);
    this.namespace = "read";
  }
  /**
   * Analyzes a URL-based audio source synchronously.
   *
   * @param source - The URL-based audio source to analyze.
   * @param options - Optional analysis options.
   * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
   * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
   */
  analyzeUrl(source, options, endpoint = ":version/read") {
    return __awaiter7(this, void 0, void 0, function* () {
      try {
        let body;
        if (isUrlSource(source)) {
          body = JSON.stringify(source);
        } else {
          throw new DeepgramError("Unknown source type");
        }
        if (options !== void 0 && "callback" in options) {
          throw new DeepgramError("Callback cannot be provided as an option to a synchronous transcription. Use `analyzeUrlCallback` or `analyzeTextCallback` instead.");
        }
        const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign({}, options));
        const result = yield this.post(requestUrl, body).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Analyzes a text-based audio source synchronously.
   *
   * @param source - The text-based audio source to analyze.
   * @param options - Optional analysis options.
   * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
   * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
   */
  analyzeText(source, options, endpoint = ":version/read") {
    return __awaiter7(this, void 0, void 0, function* () {
      try {
        let body;
        if (isTextSource(source)) {
          body = JSON.stringify(source);
        } else {
          throw new DeepgramError("Unknown source type");
        }
        if (options !== void 0 && "callback" in options) {
          throw new DeepgramError("Callback cannot be provided as an option to a synchronous requests. Use `analyzeUrlCallback` or `analyzeTextCallback` instead.");
        }
        const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign({}, options));
        const result = yield this.post(requestUrl, body).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Analyzes a URL-based audio source asynchronously.
   *
   * @param source - The URL-based audio source to analyze.
   * @param callback - The URL to call back with the analysis results.
   * @param options - Optional analysis options.
   * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
   * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
   */
  analyzeUrlCallback(source, callback, options, endpoint = ":version/read") {
    return __awaiter7(this, void 0, void 0, function* () {
      try {
        let body;
        if (isUrlSource(source)) {
          body = JSON.stringify(source);
        } else {
          throw new DeepgramError("Unknown source type");
        }
        const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign(Object.assign({}, options), { callback: callback.toString() }));
        const result = yield this.post(requestUrl, body).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Analyzes a text-based audio source asynchronously.
   *
   * @param source - The text-based audio source to analyze.
   * @param callback - The URL to call back with the analysis results.
   * @param options - Optional analysis options.
   * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
   * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
   */
  analyzeTextCallback(source, callback, options, endpoint = ":version/read") {
    return __awaiter7(this, void 0, void 0, function* () {
      try {
        let body;
        if (isTextSource(source)) {
          body = JSON.stringify(source);
        } else {
          throw new DeepgramError("Unknown source type");
        }
        const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign(Object.assign({}, options), { callback: callback.toString() }));
        const result = yield this.post(requestUrl, body, {
          headers: { "Content-Type": "deepgram/audio+video" }
        }).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/packages/SelfHostedRestClient.js
var __awaiter8 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var SelfHostedRestClient = class extends AbstractRestClient {
  constructor() {
    super(...arguments);
    this.namespace = "selfhosted";
  }
  /**
   * Lists the self-hosted credentials for a Deepgram project.
   *
   * @param projectId - The ID of the Deepgram project.
   * @returns A promise that resolves to an object containing the list of self-hosted credentials and any error that occurred.
   * @see https://developers.deepgram.com/reference/list-credentials
   */
  listCredentials(projectId, endpoint = ":version/projects/:projectId/onprem/distribution/credentials") {
    return __awaiter8(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Retrieves the self-hosted credentials for a specific Deepgram project and credentials ID.
   *
   * @param projectId - The ID of the Deepgram project.
   * @param credentialsId - The ID of the self-hosted credentials to retrieve.
   * @returns A promise that resolves to an object containing the self-hosted credentials and any error that occurred.
   * @see https://developers.deepgram.com/reference/get-credentials
   */
  getCredentials(projectId, credentialsId, endpoint = ":version/projects/:projectId/onprem/distribution/credentials/:credentialsId") {
    return __awaiter8(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId, credentialsId });
        const result = yield this.get(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Creates self-hosted credentials for a specific Deepgram project.
   *
   * @param projectId - The ID of the Deepgram project.
   * @param options - The options for creating the self-hosted credentials.
   * @returns A promise that resolves to an object containing the created self-hosted credentials and any error that occurred.
   * @see https://developers.deepgram.com/reference/create-credentials
   */
  createCredentials(projectId, options, endpoint = ":version/projects/:projectId/onprem/distribution/credentials") {
    return __awaiter8(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId });
        const body = JSON.stringify(options);
        const result = yield this.post(requestUrl, body).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
  /**
   * Deletes self-hosted credentials for a specific Deepgram project.
   *
   * @param projectId - The ID of the Deepgram project.
   * @param credentialsId - The ID of the self-hosted credentials to delete.
   * @returns A promise that resolves to an object containing a message response and any error that occurred.
   * @see https://developers.deepgram.com/reference/delete-credentials
   */
  deleteCredentials(projectId, credentialsId, endpoint = ":version/projects/:projectId/onprem/distribution/credentials/:credentialsId") {
    return __awaiter8(this, void 0, void 0, function* () {
      try {
        const requestUrl = this.getRequestUrl(endpoint, { projectId, credentialsId });
        const result = yield this.delete(requestUrl).then((result2) => result2.json());
        return { result, error: null };
      } catch (error) {
        if (isDeepgramError(error)) {
          return { result: null, error };
        }
        throw error;
      }
    });
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/packages/SpeakLiveClient.js
var SpeakLiveClient = class extends AbstractLiveClient {
  /**
   * Constructs a new `SpeakLiveClient` instance with the provided options.
   *
   * @param options - The `DeepgramClientOptions` to use for the client connection.
   * @param speakOptions - An optional `SpeakSchema` object containing additional configuration options for the text-to-speech.
   * @param endpoint - An optional string representing the WebSocket endpoint to connect to. Defaults to `:version/speak`.
   */
  constructor(options, speakOptions = {}, endpoint = ":version/speak") {
    super(options);
    this.namespace = "speak";
    this.connect(speakOptions, endpoint);
  }
  /**
   * Sets up the connection event handlers.
   * This method is responsible for handling the various events that can occur on the WebSocket connection, such as opening, closing, and receiving data.
   * - When the connection is opened, it emits the `LiveTTSEvents.Open` event.
   * - When the connection is closed, it emits the `LiveTTSEvents.Close` event.
   * - When an error occurs on the connection, it emits the `LiveTTSEvents.Error` event.
   * - When a message is received, it parses the message and emits the appropriate event based on the message type, such as `LiveTTSEvents.Metadata`, `LiveTTSEvents.Flushed`, and `LiveTTSEvents.Warning`.
   */
  setupConnection() {
    if (this.conn) {
      this.conn.onopen = () => {
        this.emit(LiveTTSEvents.Open, this);
      };
      this.conn.onclose = (event) => {
        this.emit(LiveTTSEvents.Close, event);
      };
      this.conn.onerror = (event) => {
        this.emit(LiveTTSEvents.Error, event);
      };
      this.conn.onmessage = (event) => {
        this.handleMessage(event);
      };
    }
  }
  /**
   * Handles text messages received from the WebSocket connection.
   * @param data - The parsed JSON data.
   */
  handleTextMessage(data) {
    if (data.type === LiveTTSEvents.Metadata) {
      this.emit(LiveTTSEvents.Metadata, data);
    } else if (data.type === LiveTTSEvents.Flushed) {
      this.emit(LiveTTSEvents.Flushed, data);
    } else if (data.type === LiveTTSEvents.Warning) {
      this.emit(LiveTTSEvents.Warning, data);
    } else {
      this.emit(LiveTTSEvents.Unhandled, data);
    }
  }
  /**
   * Handles binary messages received from the WebSocket connection.
   * @param data - The binary data.
   */
  handleBinaryMessage(data) {
    this.emit(LiveTTSEvents.Audio, data);
  }
  /**
   * Sends a text input message to the server.
   *
   * @param {string} text - The text to convert to speech.
   */
  sendText(text) {
    this.send(JSON.stringify({
      type: "Speak",
      text
    }));
  }
  /**
   * Requests the server flush the current buffer and return generated audio.
   */
  flush() {
    this.send(JSON.stringify({
      type: "Flush"
    }));
  }
  /**
   * Requests the server clear the current buffer.
   */
  clear() {
    this.send(JSON.stringify({
      type: "Clear"
    }));
  }
  /**
   * Requests the server close the connection.
   */
  requestClose() {
    this.send(JSON.stringify({
      type: "Close"
    }));
  }
  /**
   * Handles incoming messages from the WebSocket connection.
   * @param event - The MessageEvent object representing the received message.
   */
  handleMessage(event) {
    if (typeof event.data === "string") {
      try {
        const data = JSON.parse(event.data);
        this.handleTextMessage(data);
      } catch (error) {
        this.emit(LiveTTSEvents.Error, {
          event,
          message: "Unable to parse `data` as JSON.",
          error
        });
      }
    } else if (event.data instanceof Blob) {
      event.data.arrayBuffer().then((buffer) => {
        this.handleBinaryMessage(Buffer.from(buffer));
      });
    } else if (event.data instanceof ArrayBuffer) {
      this.handleBinaryMessage(Buffer.from(event.data));
    } else if (Buffer.isBuffer(event.data)) {
      this.handleBinaryMessage(event.data);
    } else {
      console.log("Received unknown data type", event.data);
      this.emit(LiveTTSEvents.Error, {
        event,
        message: "Received unknown data type."
      });
    }
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/packages/SpeakRestClient.js
var __awaiter9 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var SpeakRestClient = class extends AbstractRestClient {
  constructor() {
    super(...arguments);
    this.namespace = "speak";
  }
  /**
   * Sends a request to the Deepgram Text-to-Speech API to generate audio from the provided text source.
   *
   * @param source - The text source to be converted to audio.
   * @param options - Optional configuration options for the text-to-speech request.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/speak".
   * @returns A promise that resolves to the SpeakRestClient instance, which can be used to retrieve the response headers and body.
   * @throws {DeepgramError} If the text source type is unknown.
   * @throws {DeepgramUnknownError} If the request was made before a previous request completed.
   * @see https://developers.deepgram.com/reference/text-to-speech-api
   */
  request(source, options, endpoint = ":version/speak") {
    return __awaiter9(this, void 0, void 0, function* () {
      let body;
      if (isTextSource(source)) {
        body = JSON.stringify(source);
      } else {
        throw new DeepgramError("Unknown transcription source type");
      }
      const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign({ model: "aura-asteria-en" }, options));
      this.result = yield this.post(requestUrl, body, {
        headers: { Accept: "audio/*", "Content-Type": "application/json" }
      });
      return this;
    });
  }
  /**
   * Retrieves the response body as a readable stream.
   *
   * @returns A promise that resolves to the response body as a readable stream, or `null` if no request has been made yet.
   * @throws {DeepgramUnknownError} If a request has not been made yet.
   */
  getStream() {
    return __awaiter9(this, void 0, void 0, function* () {
      if (!this.result)
        throw new DeepgramUnknownError("Tried to get stream before making request", "");
      return this.result.body;
    });
  }
  /**
   * Retrieves the response headers from the previous request.
   *
   * @returns A promise that resolves to the response headers, or throws a `DeepgramUnknownError` if no request has been made yet.
   */
  getHeaders() {
    return __awaiter9(this, void 0, void 0, function* () {
      if (!this.result)
        throw new DeepgramUnknownError("Tried to get headers before making request", "");
      return this.result.headers;
    });
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/packages/SpeakClient.js
var SpeakClient = class extends AbstractClient {
  constructor() {
    super(...arguments);
    this.namespace = "speak";
  }
  /**
   * Returns a `SpeakRestClient` instance for interacting with the rest speak API.
   */
  request(source, options, endpoint = ":version/speak") {
    const client = new SpeakRestClient(this.options);
    return client.request(source, options, endpoint);
  }
  /**
   * Returns a `SpeakLiveClient` instance for interacting with the live speak API, with the provided TTS options and endpoint.
   * @param {SpeakSchema} [ttsOptions={}] - The TTS options to use for the live speak API.
   * @param {string} [endpoint=":version/speak"] - The endpoint to use for the live speak API.
   * @returns {SpeakLiveClient} - A `SpeakLiveClient` instance for interacting with the live speak API.
   */
  live(ttsOptions = {}, endpoint = ":version/speak") {
    return new SpeakLiveClient(this.options, ttsOptions, endpoint);
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/DeepgramClient.js
var DeepgramClient = class extends AbstractClient {
  /**
   * Returns a new instance of the ListenClient, which provides access to the Deepgram API's listening functionality.
   *
   * @returns {ListenClient} A new instance of the ListenClient.
   */
  get listen() {
    return new ListenClient(this.options);
  }
  /**
   * Returns a new instance of the ManageClient, which provides access to the Deepgram API's management functionality.
   *
   * @returns {ManageClient} A new instance of the ManageClient.
   */
  get manage() {
    return new ManageRestClient(this.options);
  }
  /**
   * Returns a new instance of the ModelsRestClient, which provides access to the Deepgram API's model functionality.
   *
   * @returns {ModelsRestClient} A new instance of the ModelsRestClient.
   */
  get models() {
    return new ModelsRestClient(this.options);
  }
  /**
   * Returns a new instance of the SelfHostedRestClient, which provides access to the Deepgram API's self-hosted functionality.
   *
   * @returns {OnPremClient} A new instance of the SelfHostedRestClient named as OnPremClient.
   * @deprecated use selfhosted() instead
   */
  get onprem() {
    return this.selfhosted;
  }
  /**
   * Returns a new instance of the SelfHostedRestClient, which provides access to the Deepgram API's self-hosted functionality.
   *
   * @returns {SelfHostedRestClient} A new instance of the SelfHostedRestClient.
   */
  get selfhosted() {
    return new SelfHostedRestClient(this.options);
  }
  /**
   * Returns a new instance of the ReadClient, which provides access to the Deepgram API's reading functionality.
   *
   * @returns {ReadClient} A new instance of the ReadClient.
   */
  get read() {
    return new ReadRestClient(this.options);
  }
  /**
   * Returns a new instance of the SpeakClient, which provides access to the Deepgram API's speaking functionality.
   *
   * @returns {SpeakClient} A new instance of the SpeakClient.
   */
  get speak() {
    return new SpeakClient(this.options);
  }
  /**
   * @deprecated
   * @see https://dpgr.am/js-v3
   */
  get transcription() {
    throw new DeepgramVersionError();
  }
  /**
   * @deprecated
   * @see https://dpgr.am/js-v3
   */
  get projects() {
    throw new DeepgramVersionError();
  }
  /**
   * @deprecated
   * @see https://dpgr.am/js-v3
   */
  get keys() {
    throw new DeepgramVersionError();
  }
  /**
   * @deprecated
   * @see https://dpgr.am/js-v3
   */
  get members() {
    throw new DeepgramVersionError();
  }
  /**
   * @deprecated
   * @see https://dpgr.am/js-v3
   */
  get scopes() {
    throw new DeepgramVersionError();
  }
  /**
   * @deprecated
   * @see https://dpgr.am/js-v3
   */
  get invitation() {
    throw new DeepgramVersionError();
  }
  /**
   * @deprecated
   * @see https://dpgr.am/js-v3
   */
  get usage() {
    throw new DeepgramVersionError();
  }
  /**
   * @deprecated
   * @see https://dpgr.am/js-v3
   */
  get billing() {
    throw new DeepgramVersionError();
  }
};

// ../../node_modules/@deepgram/sdk/dist/module/index.js
function createClient(keyOrOptions, options) {
  let resolvedOptions = {};
  if (typeof keyOrOptions === "string" || typeof keyOrOptions === "function") {
    if (typeof options === "object") {
      resolvedOptions = options;
    }
    resolvedOptions.key = keyOrOptions;
  } else if (typeof keyOrOptions === "object") {
    resolvedOptions = keyOrOptions;
  }
  return new DeepgramClient(resolvedOptions);
}

// src/services/transcription.ts
var __filename = fileURLToPath2(import.meta.url);
var __dirname2 = path3.dirname(__filename);
var execAsync = promisify(exec);
var TranscriptionService = class extends Service6 {
  runtime = null;
  static serviceType = ServiceType6.TRANSCRIPTION;
  CONTENT_CACHE_DIR;
  DEBUG_AUDIO_DIR;
  TARGET_SAMPLE_RATE = 16e3;
  // Common sample rate for speech recognition
  isCudaAvailable = false;
  openai = null;
  deepgram;
  queue = [];
  processing = false;
  async initialize(_runtime) {
    this.runtime = _runtime;
    const deepgramKey = this.runtime.getSetting("DEEPGRAM_API_KEY");
    this.deepgram = deepgramKey ? createClient(deepgramKey) : null;
  }
  constructor() {
    super();
    const rootDir = path3.resolve(__dirname2, "../../");
    this.CONTENT_CACHE_DIR = path3.join(rootDir, "content_cache");
    this.DEBUG_AUDIO_DIR = path3.join(rootDir, "debug_audio");
    this.ensureCacheDirectoryExists();
    this.ensureDebugDirectoryExists();
  }
  ensureCacheDirectoryExists() {
    if (!fs3.existsSync(this.CONTENT_CACHE_DIR)) {
      fs3.mkdirSync(this.CONTENT_CACHE_DIR, { recursive: true });
    }
  }
  ensureDebugDirectoryExists() {
    if (!fs3.existsSync(this.DEBUG_AUDIO_DIR)) {
      fs3.mkdirSync(this.DEBUG_AUDIO_DIR, { recursive: true });
    }
  }
  detectCuda() {
    const platform = os2.platform();
    if (platform === "linux") {
      try {
        fs3.accessSync("/usr/local/cuda/bin/nvcc", fs3.constants.X_OK);
        this.isCudaAvailable = true;
        console.log(
          "CUDA detected. Transcription will use CUDA acceleration."
        );
      } catch (_error) {
        console.log(
          "CUDA not detected. Transcription will run on CPU."
        );
      }
    } else if (platform === "win32") {
      const cudaPath = path3.join(
        settings2.CUDA_PATH || "C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v11.0",
        "bin",
        "nvcc.exe"
      );
      if (fs3.existsSync(cudaPath)) {
        this.isCudaAvailable = true;
        console.log(
          "CUDA detected. Transcription will use CUDA acceleration."
        );
      } else {
        console.log(
          "CUDA not detected. Transcription will run on CPU."
        );
      }
    } else {
      console.log(
        "CUDA not supported on this platform. Transcription will run on CPU."
      );
    }
  }
  async convertAudio(inputBuffer) {
    const inputPath = path3.join(
      this.CONTENT_CACHE_DIR,
      `input_${Date.now()}.wav`
    );
    const outputPath = path3.join(
      this.CONTENT_CACHE_DIR,
      `output_${Date.now()}.wav`
    );
    fs3.writeFileSync(inputPath, Buffer.from(inputBuffer));
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries stream=codec_name,sample_rate,channels -of json "${inputPath}"`
      );
      const probeResult = JSON.parse(stdout);
      const stream = probeResult.streams[0];
      elizaLogger4.log("Input audio info:", stream);
      let ffmpegCommand = `ffmpeg -i "${inputPath}" -ar ${this.TARGET_SAMPLE_RATE} -ac 1`;
      if (stream.codec_name === "pcm_f32le") {
        ffmpegCommand += " -acodec pcm_s16le";
      }
      ffmpegCommand += ` "${outputPath}"`;
      elizaLogger4.log("FFmpeg command:", ffmpegCommand);
      await execAsync(ffmpegCommand);
      const convertedBuffer = fs3.readFileSync(outputPath);
      fs3.unlinkSync(inputPath);
      fs3.unlinkSync(outputPath);
      return convertedBuffer;
    } catch (error) {
      elizaLogger4.error("Error converting audio:", error);
      throw error;
    }
  }
  async saveDebugAudio(audioBuffer, prefix) {
    this.ensureDebugDirectoryExists();
    const filename = `${prefix}_${Date.now()}.wav`;
    const filePath = path3.join(this.DEBUG_AUDIO_DIR, filename);
    fs3.writeFileSync(filePath, Buffer.from(audioBuffer));
    elizaLogger4.log(`Debug audio saved: ${filePath}`);
  }
  async transcribeAttachment(audioBuffer) {
    return await this.transcribe(audioBuffer);
  }
  async transcribe(audioBuffer) {
    if (audioBuffer.byteLength < 0.2 * 16e3) {
      return null;
    }
    return new Promise((resolve) => {
      this.queue.push({ audioBuffer, resolve });
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  async transcribeAttachmentLocally(audioBuffer) {
    return this.transcribeLocally(audioBuffer);
  }
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    this.processing = true;
    while (this.queue.length > 0) {
      const { audioBuffer, resolve } = this.queue.shift();
      let result = null;
      if (this.deepgram) {
        result = await this.transcribeWithDeepgram(audioBuffer);
      } else if (this.openai) {
        result = await this.transcribeWithOpenAI(audioBuffer);
      } else {
        result = await this.transcribeLocally(audioBuffer);
      }
      resolve(result);
    }
    this.processing = false;
  }
  async transcribeWithDeepgram(audioBuffer) {
    const buffer = Buffer.from(audioBuffer);
    const response = await this.deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: "nova-2",
        language: "en-US",
        smart_format: true
      }
    );
    const result = response.result.results.channels[0].alternatives[0].transcript;
    return result;
  }
  async transcribeWithOpenAI(audioBuffer) {
    elizaLogger4.log("Transcribing audio with OpenAI...");
    try {
      await this.saveDebugAudio(audioBuffer, "openai_input_original");
      const convertedBuffer = await this.convertAudio(audioBuffer);
      await this.saveDebugAudio(
        convertedBuffer,
        "openai_input_converted"
      );
      const file = new File([convertedBuffer], "audio.wav", {
        type: "audio/wav"
      });
      const result = await this.openai.audio.transcriptions.create({
        model: "whisper-1",
        language: "en",
        response_format: "text",
        file
      });
      const trimmedResult = result.trim();
      elizaLogger4.log(`OpenAI speech to text result: "${trimmedResult}"`);
      return trimmedResult;
    } catch (error) {
      elizaLogger4.error(
        "Error in OpenAI speech-to-text conversion:",
        error
      );
      if (error.response) {
        elizaLogger4.error("Response data:", error.response.data);
        elizaLogger4.error("Response status:", error.response.status);
        elizaLogger4.error("Response headers:", error.response.headers);
      } else if (error.request) {
        elizaLogger4.error("No response received:", error.request);
      } else {
        elizaLogger4.error("Error setting up request:", error.message);
      }
      return null;
    }
  }
  async transcribeLocally(audioBuffer) {
    try {
      elizaLogger4.log("Transcribing audio locally...");
      await this.saveDebugAudio(audioBuffer, "local_input_original");
      const convertedBuffer = await this.convertAudio(audioBuffer);
      await this.saveDebugAudio(convertedBuffer, "local_input_converted");
      const tempWavFile = path3.join(
        this.CONTENT_CACHE_DIR,
        `temp_${Date.now()}.wav`
      );
      fs3.writeFileSync(tempWavFile, convertedBuffer);
      elizaLogger4.debug(`Temporary WAV file created: ${tempWavFile}`);
      let output = await nodewhisper(tempWavFile, {
        modelName: "base.en",
        autoDownloadModelName: "base.en",
        verbose: false,
        removeWavFileAfterTranscription: false,
        withCuda: this.isCudaAvailable,
        whisperOptions: {
          outputInText: true,
          outputInVtt: false,
          outputInSrt: false,
          outputInCsv: false,
          translateToEnglish: false,
          wordTimestamps: false,
          timestamps_length: 60
          // splitOnWord: true,
        }
      });
      output = output.split("\n").map((line) => {
        if (line.trim().startsWith("[")) {
          const endIndex = line.indexOf("]");
          return line.substring(endIndex + 1);
        }
        return line;
      }).join("\n");
      fs3.unlinkSync(tempWavFile);
      if (!output || output.length < 5) {
        elizaLogger4.log("Output is null or too short, returning null");
        return null;
      }
      return output;
    } catch (error) {
      elizaLogger4.error(
        "Error in local speech-to-text conversion:",
        error
      );
      return null;
    }
  }
};

// src/services/video.ts
import { Service as Service7 } from "@ai16z/eliza";
import {
  ServiceType as ServiceType7
} from "@ai16z/eliza";
import { stringToUuid as stringToUuid2 } from "@ai16z/eliza";
import ffmpeg from "fluent-ffmpeg";
import fs4 from "fs";
import path4 from "path";
import { tmpdir } from "os";
import youtubeDl from "youtube-dl-exec";
var VideoService = class _VideoService extends Service7 {
  static serviceType = ServiceType7.VIDEO;
  cacheKey = "content/video";
  dataDir = "./content_cache";
  queue = [];
  processing = false;
  constructor() {
    super();
    this.ensureDataDirectoryExists();
  }
  getInstance() {
    return _VideoService.getInstance();
  }
  async initialize(_runtime) {
  }
  ensureDataDirectoryExists() {
    if (!fs4.existsSync(this.dataDir)) {
      fs4.mkdirSync(this.dataDir);
    }
  }
  isVideoUrl(url) {
    return url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com");
  }
  async downloadMedia(url) {
    const videoId = this.getVideoId(url);
    const outputFile = path4.join(this.dataDir, `${videoId}.mp4`);
    if (fs4.existsSync(outputFile)) {
      return outputFile;
    }
    try {
      await youtubeDl(url, {
        verbose: true,
        output: outputFile,
        writeInfoJson: true
      });
      return outputFile;
    } catch (error) {
      console.error("Error downloading media:", error);
      throw new Error("Failed to download media");
    }
  }
  async downloadVideo(videoInfo) {
    const videoId = this.getVideoId(videoInfo.webpage_url);
    const outputFile = path4.join(this.dataDir, `${videoId}.mp4`);
    if (fs4.existsSync(outputFile)) {
      return outputFile;
    }
    try {
      await youtubeDl(videoInfo.webpage_url, {
        verbose: true,
        output: outputFile,
        format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        writeInfoJson: true
      });
      return outputFile;
    } catch (error) {
      console.error("Error downloading video:", error);
      throw new Error("Failed to download video");
    }
  }
  async processVideo(url, runtime) {
    this.queue.push(url);
    this.processQueue(runtime);
    return new Promise((resolve, reject) => {
      const checkQueue = async () => {
        const index = this.queue.indexOf(url);
        if (index !== -1) {
          setTimeout(checkQueue, 100);
        } else {
          try {
            const result = await this.processVideoFromUrl(
              url,
              runtime
            );
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }
      };
      checkQueue();
    });
  }
  async processQueue(runtime) {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    this.processing = true;
    while (this.queue.length > 0) {
      const url = this.queue.shift();
      await this.processVideoFromUrl(url, runtime);
    }
    this.processing = false;
  }
  async processVideoFromUrl(url, runtime) {
    const videoId = url.match(
      /(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^\/&?]+)/
      // eslint-disable-line
    )?.[1] || "";
    const videoUuid = this.getVideoId(videoId);
    const cacheKey = `${this.cacheKey}/${videoUuid}`;
    const cached = await runtime.cacheManager.get(cacheKey);
    if (cached) {
      console.log("Returning cached video file");
      return cached;
    }
    console.log("Cache miss, processing video");
    console.log("Fetching video info");
    const videoInfo = await this.fetchVideoInfo(url);
    console.log("Getting transcript");
    const transcript = await this.getTranscript(url, videoInfo, runtime);
    const result = {
      id: videoUuid,
      url,
      title: videoInfo.title,
      source: videoInfo.channel,
      description: videoInfo.description,
      text: transcript
    };
    await runtime.cacheManager.set(cacheKey, result);
    return result;
  }
  getVideoId(url) {
    return stringToUuid2(url);
  }
  async fetchVideoInfo(url) {
    if (url.endsWith(".mp4") || url.includes(".mp4?")) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return {
            title: path4.basename(url),
            description: "",
            channel: ""
          };
        }
      } catch (error) {
        console.error("Error downloading MP4 file:", error);
      }
    }
    try {
      const result = await youtubeDl(url, {
        dumpJson: true,
        verbose: true,
        callHome: false,
        noCheckCertificates: true,
        preferFreeFormats: true,
        youtubeSkipDashManifest: true,
        writeSub: true,
        writeAutoSub: true,
        subLang: "en",
        skipDownload: true
      });
      return result;
    } catch (error) {
      console.error("Error fetching video info:", error);
      throw new Error("Failed to fetch video information");
    }
  }
  async getTranscript(url, videoInfo, runtime) {
    console.log("Getting transcript");
    try {
      if (videoInfo.subtitles && videoInfo.subtitles.en) {
        console.log("Manual subtitles found");
        const srtContent = await this.downloadSRT(
          videoInfo.subtitles.en[0].url
        );
        return this.parseSRT(srtContent);
      }
      if (videoInfo.automatic_captions && videoInfo.automatic_captions.en) {
        console.log("Automatic captions found");
        const captionUrl = videoInfo.automatic_captions.en[0].url;
        const captionContent = await this.downloadCaption(captionUrl);
        return this.parseCaption(captionContent);
      }
      if (videoInfo.categories && videoInfo.categories.includes("Music")) {
        console.log("Music video detected, no lyrics available");
        return "No lyrics available.";
      }
      console.log(
        "No captions found, falling back to audio transcription"
      );
      return this.transcribeAudio(url, runtime);
    } catch (error) {
      console.error("Error in getTranscript:", error);
      throw error;
    }
  }
  async downloadCaption(url) {
    console.log("Downloading caption from:", url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download caption: ${response.statusText}`
      );
    }
    return await response.text();
  }
  parseCaption(captionContent) {
    console.log("Parsing caption");
    try {
      const jsonContent = JSON.parse(captionContent);
      if (jsonContent.events) {
        return jsonContent.events.filter((event) => event.segs).map((event) => event.segs.map((seg) => seg.utf8).join("")).join("").replace("\n", " ");
      } else {
        console.error("Unexpected caption format:", jsonContent);
        return "Error: Unable to parse captions";
      }
    } catch (error) {
      console.error("Error parsing caption:", error);
      return "Error: Unable to parse captions";
    }
  }
  parseSRT(srtContent) {
    return srtContent.split("\n\n").map((block) => block.split("\n").slice(2).join(" ")).join(" ");
  }
  async downloadSRT(url) {
    console.log("downloadSRT");
    const response = await fetch(url);
    return await response.text();
  }
  async transcribeAudio(url, runtime) {
    console.log("Preparing audio for transcription...");
    const mp4FilePath = path4.join(
      this.dataDir,
      `${this.getVideoId(url)}.mp4`
    );
    const mp3FilePath = path4.join(
      this.dataDir,
      `${this.getVideoId(url)}.mp3`
    );
    if (!fs4.existsSync(mp3FilePath)) {
      if (fs4.existsSync(mp4FilePath)) {
        console.log("MP4 file found. Converting to MP3...");
        await this.convertMp4ToMp3(mp4FilePath, mp3FilePath);
      } else {
        console.log("Downloading audio...");
        await this.downloadAudio(url, mp3FilePath);
      }
    }
    console.log(`Audio prepared at ${mp3FilePath}`);
    const audioBuffer = fs4.readFileSync(mp3FilePath);
    console.log(`Audio file size: ${audioBuffer.length} bytes`);
    console.log("Starting transcription...");
    const startTime = Date.now();
    const transcriptionService = runtime.getService(
      ServiceType7.TRANSCRIPTION
    );
    if (!transcriptionService) {
      throw new Error("Transcription service not found");
    }
    const transcript = await transcriptionService.transcribe(audioBuffer);
    const endTime = Date.now();
    console.log(
      `Transcription completed in ${(endTime - startTime) / 1e3} seconds`
    );
    return transcript || "Transcription failed";
  }
  async convertMp4ToMp3(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath).output(outputPath).noVideo().audioCodec("libmp3lame").on("end", () => {
        console.log("Conversion to MP3 complete");
        resolve();
      }).on("error", (err) => {
        console.error("Error converting to MP3:", err);
        reject(err);
      }).run();
    });
  }
  async downloadAudio(url, outputFile) {
    console.log("Downloading audio");
    outputFile = outputFile ?? path4.join(this.dataDir, `${this.getVideoId(url)}.mp3`);
    try {
      if (url.endsWith(".mp4") || url.includes(".mp4?")) {
        console.log(
          "Direct MP4 file detected, downloading and converting to MP3"
        );
        const tempMp4File = path4.join(
          tmpdir(),
          `${this.getVideoId(url)}.mp4`
        );
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs4.writeFileSync(tempMp4File, buffer);
        await new Promise((resolve, reject) => {
          ffmpeg(tempMp4File).output(outputFile).noVideo().audioCodec("libmp3lame").on("end", () => {
            fs4.unlinkSync(tempMp4File);
            resolve();
          }).on("error", (err) => {
            reject(err);
          }).run();
        });
      } else {
        console.log(
          "YouTube video detected, downloading audio with youtube-dl"
        );
        await youtubeDl(url, {
          verbose: true,
          extractAudio: true,
          audioFormat: "mp3",
          output: outputFile,
          writeInfoJson: true
        });
      }
      return outputFile;
    } catch (error) {
      console.error("Error downloading audio:", error);
      throw new Error("Failed to download audio");
    }
  }
};

// src/services/awsS3.ts
import {
  Service as Service8,
  ServiceType as ServiceType8
} from "@ai16z/eliza";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs5 from "fs";
import * as path5 from "path";
var AwsS3Service = class extends Service8 {
  static serviceType = ServiceType8.AWS_S3;
  s3Client = null;
  bucket = "";
  fileUploadPath = "";
  runtime = null;
  async initialize(runtime) {
    console.log("Initializing AwsS3Service");
    this.runtime = runtime;
    this.fileUploadPath = runtime.getSetting("AWS_S3_UPLOAD_PATH") ?? "";
  }
  async initializeS3Client() {
    if (this.s3Client) return true;
    if (!this.runtime) return false;
    const AWS_ACCESS_KEY_ID = this.runtime.getSetting("AWS_ACCESS_KEY_ID");
    const AWS_SECRET_ACCESS_KEY = this.runtime.getSetting("AWS_SECRET_ACCESS_KEY");
    const AWS_REGION = this.runtime.getSetting("AWS_REGION");
    const AWS_S3_BUCKET = this.runtime.getSetting("AWS_S3_BUCKET");
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !AWS_S3_BUCKET) {
      return false;
    }
    this.s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
      }
    });
    this.bucket = AWS_S3_BUCKET;
    return true;
  }
  async uploadFile(filePath, useSignedUrl = false, expiresIn = 900) {
    try {
      if (!await this.initializeS3Client()) {
        return {
          success: false,
          error: "AWS S3 credentials not configured"
        };
      }
      if (!fs5.existsSync(filePath)) {
        return {
          success: false,
          error: "File does not exist"
        };
      }
      const fileContent = fs5.readFileSync(filePath);
      const baseFileName = `${Date.now()}-${path5.basename(filePath)}`;
      const fileName = `${this.fileUploadPath}/${baseFileName}`.replaceAll("//", "/");
      const uploadParams = {
        Bucket: this.bucket,
        Key: fileName,
        Body: fileContent,
        ContentType: this.getContentType(filePath)
      };
      await this.s3Client.send(new PutObjectCommand(uploadParams));
      const result = {
        success: true
      };
      if (!useSignedUrl) {
        result.url = `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      } else {
        const getObjectCommand = new GetObjectCommand({
          Bucket: this.bucket,
          Key: fileName
        });
        result.url = await getSignedUrl(
          this.s3Client,
          getObjectCommand,
          {
            expiresIn
            // 15 minutes in seconds
          }
        );
      }
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }
  /**
   * Generate signed URL for existing file
   */
  async generateSignedUrl(fileName, expiresIn = 900) {
    if (!await this.initializeS3Client()) {
      throw new Error("AWS S3 credentials not configured");
    }
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileName
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }
  getContentType(filePath) {
    const ext = path5.extname(filePath).toLowerCase();
    const contentTypes = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp"
    };
    return contentTypes[ext] || "application/octet-stream";
  }
  /**
   * Upload JSON object to S3
   * @param jsonData JSON data to upload
   * @param fileName File name (optional, without path)
   * @param subDirectory Subdirectory (optional)
   * @param useSignedUrl Whether to use signed URL
   * @param expiresIn Signed URL expiration time (seconds)
   */
  async uploadJson(jsonData, fileName, subDirectory, useSignedUrl = false, expiresIn = 900) {
    try {
      if (!await this.initializeS3Client()) {
        return {
          success: false,
          error: "AWS S3 credentials not configured"
        };
      }
      if (!jsonData) {
        return {
          success: false,
          error: "JSON data is required"
        };
      }
      const timestamp = Date.now();
      const actualFileName = fileName || `${timestamp}.json`;
      let fullPath = this.fileUploadPath || "";
      if (subDirectory) {
        fullPath = `${fullPath}/${subDirectory}`.replace(/\/+/g, "/");
      }
      const key = `${fullPath}/${actualFileName}`.replace(/\/+/g, "/");
      const jsonString = JSON.stringify(jsonData, null, 2);
      const uploadParams = {
        Bucket: this.bucket,
        Key: key,
        Body: jsonString,
        ContentType: "application/json"
      };
      await this.s3Client.send(new PutObjectCommand(uploadParams));
      const result = {
        success: true,
        key
      };
      if (!useSignedUrl) {
        result.url = `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      } else {
        const getObjectCommand = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key
        });
        result.url = await getSignedUrl(
          this.s3Client,
          getObjectCommand,
          { expiresIn }
        );
      }
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }
};

// src/index.ts
function createNodePlugin() {
  return {
    name: "default",
    description: "Default plugin, with basic actions and evaluators",
    services: [
      new BrowserService(),
      new ImageDescriptionService(),
      new LlamaService(),
      new PdfService(),
      new SpeechService(),
      new TranscriptionService(),
      new VideoService(),
      new AwsS3Service()
    ]
  };
}
export {
  AwsS3Service,
  BrowserService,
  ImageDescriptionService,
  LlamaService,
  PdfService,
  SpeechService,
  TranscriptionService,
  VideoService,
  createNodePlugin
};
//# sourceMappingURL=index.js.map