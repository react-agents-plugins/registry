# ElizaOS Registry 

<img src="static/img/eliza_banner.jpg" alt="Eliza Banner" width="100%" />


## Intro
Eliza now supports dynamic plugin loading directly from the package registry.


### Available Plugins

All official plugins are hosted at [github.com/elizaos-plugins](https://github.com/elizaos-plugins/). Currently available plugins include:

- [@elizaos/plugin-solana](https://github.com/elizaos-plugins/plugin-solana) - Solana blockchain integration
- [@elizaos/client-discord](https://github.com/elizaos-plugins/client-discord) - Discord bot integration
- [@elizaos/client-twitter](https://github.com/elizaos-plugins/client-twitter) - Twitter bot integration
- [@elizaos/plugin-whatsapp](https://github.com/elizaos-plugins/plugin-whatsapp) - WhatsApp integration
- [@elizaos/plugin-browser](https://github.com/elizaos-plugins/plugin-browser) - Web scraping capabilities
- [@elizaos/plugin-pdf](https://github.com/elizaos-plugins/plugin-pdf) - PDF processing
- [@elizaos/plugin-image](https://github.com/elizaos-plugins/plugin-image) - Image processing and analysis
- [@elizaos/plugin-video](https://github.com/elizaos-plugins/plugin-video) - Video processing capabilities
- [@elizaos/plugin-llama](https://github.com/elizaos-plugins/plugin-llama) - Local LLaMA model integration

Visit the our [Registry Hub](hhttps://eliza-plugins-hub.vercel.app/)

### Adding Plugins on eliza
1. **package.json:**
```json
{
  "dependencies": {
    "@elizaos/plugin-solana": "github:elizaos-plugins/plugin-solana",
    "@elizaos/plugin-twitter": "github:elizaos-plugins/plugin-twitter"
  }
}
```

2. **Character configuration:**
```json
{
  "name": "MyAgent",
  "plugins": [
    "@elizaos/plugin-solana",
    "@elizaos/plugin-twitter"
  ]
}
```

## Plugin Architecture

### Plugin Development

Eliza uses a unified plugin architecture where everything is a plugin - including clients, adapters, actions, evaluators, and services. This approach ensures consistent behavior and better extensibility. Here's how the architecture works:

1. **Plugin Types**: Each plugin can provide one or more of the following:
   - Clients (e.g., Discord, Twitter, WhatsApp integrations)
   - Adapters (e.g., database adapters, caching systems)
   - Actions (custom functionality)
   - Evaluators (decision-making components)
   - Services (background processes)
   - Providers (data or functionality providers)

2. **Plugin Interface**: All plugins implement the core Plugin interface:
   ```typescript
   type Plugin = {
       name: string;
       description: string;
       config?: { [key: string]: any };
       actions?: Action[];
       providers?: Provider[];
       evaluators?: Evaluator[];
       services?: Service[];
       clients?: Client[];
       adapters?: Adapter[];
   };
   ```

3. **Independent Repositories**: Each plugin lives in its own repository under the [elizaos-plugins](https://github.com/elizaos-plugins/) organization, allowing:
   - Independent versioning and releases
   - Focused issue tracking and documentation
   - Easier maintenance and contribution
   - Separate CI/CD pipelines

4. **Plugin Structure**: Each plugin repository should follow this structure:
   ```
   plugin-name/
   ├── images/
   │   ├── logo.jpg        # Plugin branding logo
   │   ├── banner.jpg      # Plugin banner image
   ├── src/
   │   ├── index.ts        # Main plugin entry point
   │   ├── actions/        # Plugin-specific actions
   │   ├── clients/        # Client implementations
   │   ├── adapters/       # Adapter implementations
   │   └── types.ts        # Type definitions
   │   └── environment.ts  # runtime.getSetting, zod validation
   ├── package.json        # Plugin dependencies
   └── README.md          # Plugin documentation
   ```

5. **Package Configuration**: Your plugin's `package.json` must include an `agentConfig` section:
   ```json
   {
     "name": "@elizaos/plugin-example",
     "version": "1.0.0",
     "agentConfig": {
       "pluginType": "elizaos:plugin:1.0.0",
       "pluginParameters": {
         "API_KEY": {
           "type": "string",
           "description": "API key for the service"
         }
       }
     }
   }
   ```

6. **Plugin Loading**: Plugins are dynamically loaded at runtime through the `handlePluginImporting` function, which:
   - Imports the plugin module
   - Reads the plugin configuration
   - Validates plugin parameters
   - Registers the plugin's components (clients, adapters, actions, etc.)

7. **Client and Adapter Implementation**: When implementing clients or adapters:

```typescript
   // Client example
   const discordPlugin: Plugin = {
     name: "discord",
     description: "Discord client plugin",
     clients: [DiscordClientInterface]
   };

   // Adapter example
   const postgresPlugin: Plugin = {
     name: "postgres",
     description: "PostgreSQL database adapter",
     adapters: [PostgresDatabaseAdapter]
   };
   
   // Adapter example
   export const browserPlugin = {
    name: "default",
    description: "Pdf",
    services: [PdfService],
    actions: [],
  };
```

### Environment Variables and Secrets

Plugins can access environment variables and secrets in two ways:

1. **Character Configuration**: Through `agent.json.secret` or character settings:
   ```json
   {
     "name": "MyAgent",
     "settings": {
       "secrets": {
         "PLUGIN_API_KEY": "your-api-key",
         "PLUGIN_SECRET": "your-secret"
       }
     }
   }
   ```

2. **Runtime Access**: Plugins can access their configuration through the runtime:
   ```typescript
   class MyPlugin implements Plugin {
     async initialize(runtime: AgentRuntime) {
       const apiKey = runtime.getSetting("PLUGIN_API_KEY");
       const secret = runtime.getSetting("PLUGIN_SECRET");
     }
   }
   ```

The `getSetting` method follows this precedence:
1. Character settings secrets
2. Character settings
3. Global settings

### Plugin Registration
1. Add it to your agent's character configuration:
   ```json
   {
     "name": "MyAgent",
     "plugins": [
       "@elizaos/plugin-example"
     ]
   }
   ```

2. Include it in your package.json:
   ```json
   {
     "dependencies": {
       "@elizaos/plugin-example": "github:elizaos-plugins/plugin-example"
     }
   }
   ```

### Creating a New Plugin

1. Use the [plugin template](https://github.com/elizaos-plugins/plugin-template) as a starting point
2. Implement the Plugin interface:
   ```typescript
   interface Plugin {
     actions?: Action[];
     evaluators?: Evaluator[];
     services?: Service[];
     providers?: Provider[];
     initialize?(runtime: AgentRuntime): Promise<void>;
   }
   ```
3. Create a plugin.json file with metadata and configuration schema
4. Document your plugin's functionality and required environment variables


### Plugin Development Guidelines

1. **Minimal Dependencies**: Only include necessary dependencies
2. **Clear Documentation**: Document all required environment variables
3. **Error Handling**: Gracefully handle missing or invalid configuration
4. **Type Safety**: Use TypeScript for better developer experience
5. **Testing**: Include tests for core functionality
6. **GitHub Topics**: Add `elizaos-plugins` as a topic to your repository along with relevant tags like `ai`, `crypto`, `social`, etc. to help with discovery and categorization

### Pull Request Requirements

When submitting a plugin to the ElizaOS Registry, your PR must include:

1. **Working Demo Evidence:**
   - Screenshots or video demonstrations of the plugin working with ElizaOS
   - Test results showing successful integration
   - Example agent configuration using your plugin
   - Documentation of any specific setup requirements

2. **Integration Testing:**
   - Proof of successful dynamic loading with ElizaOS
   - Test cases covering main functionality
   - Error handling demonstrations
   - Performance metrics (if applicable)

3. **Configuration Examples:**
   ```json
   {
     "name": "MyAgent",
     "plugins": ["@elizaos/your-plugin"],
     "settings": {
       "your-plugin": {
         // Your plugin's configuration
       }
     }
   }
   ```

4. **Quality Checklist:**
   - [ ] Plugin follows the standard structure
   - [ ] All required branding assets are included
   - [ ] Documentation is complete and clear
   - [ ] GitHub topics are properly set
   - [ ] Tests are passing
   - [ ] Demo evidence is provided

Visit the [Plugin Development Guide](https://github.com/elizaos-plugins/plugin-image) for detailed information on creating new plugins.

### Plugin Branding and Images

To maintain a consistent and professional appearance across the ElizaOS ecosystem, we recommend including the following assets in your plugin repository:

1. **Required Images:**
   - `logo.png` (400x400px) - Your plugin's square logo
   - `banner.png` (1280x640px) - A banner image for your plugin
   - `screenshot.png` - At least one screenshot demonstrating your plugin's functionality

2. **Image Location:**
   ```
   plugin-name/
   ├── assets/
   │   ├── logo.png
   │   ├── banner.png
   │   └── screenshots/
   │       ├── screenshot1.png
   │       └── screenshot2.png
   ```

3. **README Integration:**
   ```markdown
   # My Amazing Plugin
   
   <div align="center">
     <img src="assets/banner.png" alt="Plugin Banner" width="100%">
   </div>
   
   ## Screenshots
   
   <div align="center">
     <img src="assets/screenshots/screenshot1.png" alt="Feature Demo" width="80%">
   </div>
   ```

4. **Image Guidelines:**
   - Use clear, high-resolution images
   - Keep file sizes optimized (< 500KB for logos, < 1MB for banners)
   - Follow the [ElizaOS Brand Guidelines](https://github.com/elizaos-plugins/guidelines/brand.md)
   - Include alt text for accessibility

Example banner and logo placement:

<div align="center">
  <img src="https://raw.githubusercontent.com/elizaos-plugins/registry/main/assets/plugin-banner-example.png" alt="Plugin Banner Example" width="100%">
</div>

> 💡 **Pro Tip**: Use the [ElizaOS Plugin Banner Generator](https://github.com/elizaos-plugins/tools/banner-generator) to create beautiful, consistent banners for your plugins.
