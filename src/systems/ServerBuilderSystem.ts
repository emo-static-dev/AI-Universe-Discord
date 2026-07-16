import {
  Client,
  Guild,
  CategoryChannel,
  TextChannel,
  VoiceChannel,
  ChannelType,
  PermissionFlagsBits,
  Role,
} from 'discord.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ServerBuilder');

/**
 * Role configuration interface
 */
interface RoleConfig {
  name: string;
  color: string;
  position?: number;
  hoist?: boolean;
}

/**
 * Channel configuration interface
 */
interface ChannelConfig {
  name: string;
  type: 'text' | 'voice';
  topic?: string;
}

/**
 * Category configuration interface
 */
interface CategoryConfig {
  name: string;
  channels: ChannelConfig[];
}

/**
 * Server Builder System
 * Handles creation of Discord server structure:
 * - Roles with emoji names and colors
 * - Categories with custom names
 * - Channels organized by category
 */
export class ServerBuilderSystem {
  private client: Client;
  private guild: Guild;
  private logger = logger;

  // Rate limiting to respect Discord API
  private readonly RATE_LIMIT_DELAY = 800; // milliseconds
  private lastApiCall: number = 0;

  constructor(client: Client, guild: Guild) {
    this.client = client;
    this.guild = guild;
  }

  /**
   * Respect Discord rate limits between API calls
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    if (timeSinceLastCall < this.RATE_LIMIT_DELAY) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.RATE_LIMIT_DELAY - timeSinceLastCall)
      );
    }
    this.lastApiCall = Date.now();
  }

  /**
   * Main function to build complete server structure
   */
  async buildServerStructure(): Promise<void> {
    try {
      this.logger.info('═'.repeat(60));
      this.logger.info('🌌 Starting AI Universe Server Build...');
      this.logger.info('═'.repeat(60));

      // Step 1: Create Roles
      await this.createRoles();
      this.logger.info('');

      // Step 2: Create Categories & Channels
      await this.createCategoriesAndChannels();
      this.logger.info('');

      this.logger.info('═'.repeat(60));
      this.logger.info('✅ Server structure build completed successfully!');
      this.logger.info('═'.repeat(60));
    } catch (error) {
      this.logger.error('❌ Error building server structure:', error);
      throw error;
    }
  }

  /**
   * Create all roles
   */
  private async createRoles(): Promise<void> {
    this.logger.info('👑 Creating Roles...');

    const roles: RoleConfig[] = [
      { name: '👑・Universe Founder', color: '#FFD700', hoist: true },
      { name: '🌌・AI Architect', color: '#9D4EDD', hoist: true },
      { name: '💎・Executive Team', color: '#FF006E', hoist: true },
      { name: '⚡・Administrator', color: '#00BBF9', hoist: true },
      { name: '🛡️・Moderator', color: '#FF006E', hoist: false },
      { name: '🔰・Helper', color: '#3A86FF', hoist: false },
      { name: '🤖・AI Expert', color: '#06FFA5', hoist: false },
      { name: '💻・Developer', color: '#00BBF9', hoist: false },
      { name: '🎨・Creator', color: '#FB5607', hoist: false },
      { name: '🎓・Student', color: '#8338EC', hoist: false },
      { name: '⭐・Verified Member', color: '#FFBE0B', hoist: false },
      { name: '🌱・New Explorer', color: '#06FFA5', hoist: false },
    ];

    let createdCount = 0;
    let skippedCount = 0;

    for (const roleConfig of roles) {
      try {
        // Check if role already exists
        const existingRole = this.guild.roles.cache.find(
          (r) => r.name === roleConfig.name
        );

        if (existingRole) {
          this.logger.info(`  ⏭️  ${roleConfig.name} (already exists)`);
          skippedCount++;
          continue;
        }

        await this.respectRateLimit();

        await this.guild.roles.create({
          name: roleConfig.name,
          color: roleConfig.color,
          hoist: roleConfig.hoist ?? false,
          reason: 'AI Universe Server Builder - Role Creation',
        });

        this.logger.info(`  ✅ ${roleConfig.name}`);
        createdCount++;
      } catch (error) {
        this.logger.error(`  ❌ Failed to create ${roleConfig.name}:`, error);
      }
    }

    this.logger.info(
      `📊 Roles Summary: Created ${createdCount}, Skipped ${skippedCount}`
    );
  }

  /**
   * Create all categories and their channels
   */
  private async createCategoriesAndChannels(): Promise<void> {
    this.logger.info('📂 Creating Categories and Channels...');

    const categories: CategoryConfig[] = [
      {
        name: '🌌・AI UNIVERSE HUB',
        channels: [
          { name: '👋・welcome', type: 'text', topic: 'Welcome to AI Universe!' },
          { name: '📜・rules', type: 'text', topic: 'Server rules and guidelines' },
          { name: '📢・announcements', type: 'text', topic: 'Important announcements' },
          { name: '🎭・roles', type: 'text', topic: 'Role assignments' },
          { name: '💡・suggestions', type: 'text', topic: 'Share your suggestions' },
        ],
      },
      {
        name: '🤖・AI CORE LAB',
        channels: [
          { name: '🤖・ai-general', type: 'text', topic: 'General AI discussions' },
          { name: '🧠・future-of-ai', type: 'text', topic: 'Future of AI technology' },
          { name: '📰・ai-news', type: 'text', topic: 'Latest AI news' },
          { name: '❓・ai-help', type: 'text', topic: 'AI questions and answers' },
        ],
      },
      {
        name: '🧠・AI RESEARCH CENTER',
        channels: [
          { name: '📚・papers', type: 'text', topic: 'AI research papers' },
          { name: '🔬・experiments', type: 'text', topic: 'Research experiments' },
          { name: '📊・data', type: 'text', topic: 'Data science discussions' },
        ],
      },
      {
        name: '🎨・CREATIVE AI STUDIO',
        channels: [
          { name: '🖼️・ai-art', type: 'text', topic: 'AI generated art' },
          { name: '🎬・ai-video', type: 'text', topic: 'AI video generation' },
          { name: '🎵・ai-music', type: 'text', topic: 'AI music creation' },
        ],
      },
      {
        name: '💻・DEVELOPER MATRIX',
        channels: [
          { name: '💻・coding', type: 'text', topic: 'General coding help' },
          { name: '🐍・python', type: 'text', topic: 'Python programming' },
          { name: '⚡・javascript', type: 'text', topic: 'JavaScript development' },
          { name: '🔗・apis', type: 'text', topic: 'APIs and integrations' },
        ],
      },
      {
        name: '🎓・AI ACADEMY',
        channels: [
          { name: '📚・resources', type: 'text', topic: 'Learning resources' },
          { name: '🧑‍🎓・courses', type: 'text', topic: 'Course discussions' },
          { name: '❓・beginner-help', type: 'text', topic: 'Beginner questions' },
          { name: '🎯・advanced-topics', type: 'text', topic: 'Advanced concepts' },
        ],
      },
      {
        name: '🛠️・AI TOOL MARKET',
        channels: [
          { name: '🏪・tools', type: 'text', topic: 'AI tools showcase' },
          { name: '💰・marketplace', type: 'text', topic: 'Buy and sell AI services' },
          { name: '🤝・partnerships', type: 'text', topic: 'Partnership opportunities' },
        ],
      },
      {
        name: '🚀・INNOVATION LAB',
        channels: [
          { name: '💡・ideas', type: 'text', topic: 'Share innovative ideas' },
          { name: '🧪・projects', type: 'text', topic: 'Project discussions' },
          { name: '🏆・challenges', type: 'text', topic: 'AI challenges' },
        ],
      },
      {
        name: '🌍・GLOBAL COMMUNITY',
        channels: [
          { name: '🎉・giveaways', type: 'text', topic: 'Community giveaways' },
          { name: '🎊・events', type: 'text', topic: 'Community events' },
          { name: '👥・introductions', type: 'text', topic: 'Introduce yourself' },
          { name: '💬・general-chat', type: 'text', topic: 'Off-topic chat' },
        ],
      },
      {
        name: '🎮・AI GAMING WORLD',
        channels: [
          { name: '🎮・gaming', type: 'text', topic: 'AI gaming discussions' },
          { name: '🕹️・game-dev', type: 'text', topic: 'Game development' },
        ],
      },
      {
        name: '🎙️・VOICE UNIVERSE',
        channels: [
          { name: '🌎・global-lounge', type: 'voice' },
          { name: '🤖・ai-talks', type: 'voice' },
          { name: '💻・coding-room', type: 'voice' },
        ],
      },
      {
        name: '👑・STAFF COMMAND CENTER',
        channels: [
          { name: '📋・announcements', type: 'text', topic: 'Staff announcements' },
          { name: '💬・discussion', type: 'text', topic: 'Staff discussion' },
          { name: '🛡️・logs', type: 'text', topic: 'Moderation logs' },
        ],
      },
    ];

    let categoryCount = 0;
    let channelCount = 0;

    for (const categoryConfig of categories) {
      try {
        // Check if category already exists
        let category = this.guild.channels.cache.find(
          (c) => c.name === categoryConfig.name && c.type === ChannelType.GuildCategory
        ) as CategoryChannel | undefined;

        if (category) {
          this.logger.info(`  ⏭️  ${categoryConfig.name} (already exists)`);
        } else {
          await this.respectRateLimit();

          category = (await this.guild.channels.create({
            name: categoryConfig.name,
            type: ChannelType.GuildCategory,
            reason: 'AI Universe Server Builder - Category Creation',
          })) as CategoryChannel;

          this.logger.info(`  ✅ ${categoryConfig.name}`);
          categoryCount++;
        }

        // Create channels in category
        await this.createChannelsInCategory(category, categoryConfig.channels);
      } catch (error) {
        this.logger.error(`  ❌ Failed to create category ${categoryConfig.name}:`, error);
      }
    }

    this.logger.info(
      `📊 Categories & Channels Summary: ${categoryCount} categories, ${channelCount} channels created`
    );
  }

  /**
   * Create channels within a category
   */
  private async createChannelsInCategory(
    category: CategoryChannel,
    channelConfigs: ChannelConfig[]
  ): Promise<void> {
    for (const channelConfig of channelConfigs) {
      try {
        // Check if channel already exists in this category
        const existingChannel = this.guild.channels.cache.find(
          (c) => c.name === channelConfig.name && c.parentId === category.id
        );

        if (existingChannel) {
          this.logger.info(`    ⏭️  ${channelConfig.name}`);
          continue;
        }

        await this.respectRateLimit();

        const channelType =
          channelConfig.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;

        await this.guild.channels.create({
          name: channelConfig.name,
          type: channelType,
          parent: category.id,
          topic: channelConfig.topic || undefined,
          reason: 'AI Universe Server Builder - Channel Creation',
        });

        this.logger.info(`    ✅ ${channelConfig.name}`);
      } catch (error) {
        this.logger.error(`    ❌ Failed to create ${channelConfig.name}:`, error);
      }
    }
  }

  /**
   * Get server statistics
   */
  getServerStats(): {
    roles: number;
    categories: number;
    channels: number;
  } {
    const roles = this.guild.roles.cache.size;
    const categories = this.guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildCategory
    ).size;
    const channels =
      this.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size +
      this.guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;

    return { roles, categories, channels };
  }
}

export default ServerBuilderSystem;
