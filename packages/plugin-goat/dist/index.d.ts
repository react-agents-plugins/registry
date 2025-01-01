import { Plugin } from '@ai16z/eliza';

declare function createGoatPlugin(getSetting: (key: string) => string | undefined): Promise<Plugin>;

export { createGoatPlugin as default };
