import {
  Client,
  Guild,
  CategoryChannel,
  TextChannel,
  VoiceChannel,
  ForumChannel,
  StageChannel,
  ChannelType,
  PermissionFlagsBits,
  Role,
  ChannelResolvable,
  Collection,
} from 'discord.js';
import { readFileSync } from 'fs';
import { createLogger } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('ServerBuilder');

/**
 * Channel configuration interface
 */
interface ChannelConfig {
  name: string;
  type: 'text' | 'voice' | 'forum' | 'stage';
  topic?: string;
  description?: string;
  nsfw?: boolean;
  private?: boolean;
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
}

/**
 * Category configuration interface
 */
interface CategoryConfig {
  id: string;
  name: string;
  position?: number;
  channels: ChannelConfig[];
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
}

/**
 * Role configuration interface
 */
interface RoleConfig {
  name: string;
  color: string;
  permissions: string[];
  tier: string;
  hoist?: boolean;
  mentionable?: boolean;
}

/**
 * Server structure configuration interface
 */
interface ServerStructure {
  serverName: string;
  serverDescription: string;
  categories: CategoryConfig[];
  roles: {
    hierarchy: RoleConfig[];
  };
}

/**
 * Advanced Server Builder System
 * Handles complete automated creation and configuration of Discord servers
 * with categories, channels, roles, and permissions
 */
export class ServerBuilderSystem {
  private client: Client;
  private guild: Guild;
  private logger = logger;
  private config: ServerStructure;
  private createdRoles: Map<string, Role> = new Map();
  private createdCategories: Map<string, CategoryChannel> = new Map();
  private createdChannels: Map<string, TextChannel | VoiceChannel | ForumChannel | StageChannel> = new Map();

  // Rate limit configuration
  private readonly RATE_LIMIT_DELAY = 1000; // 1 second between operations
  private lastApiCall: number = 0;

  constructor(client: Client, guild: Guild) {
    this.client = client;
    this.guild = guild;
    this.config = this.loadConfiguration();
  }

  /**
   * Load server structure configuration from JSON file
   */
  private loadConfiguration(): ServerStructure {
    try {
      const configPath = path.join(__dirname, '../config/server-structure.json');
      const rawData = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(rawData) as ServerStructure;
      this.logger.info(`✅ Configuration loaded from ${configPath}`);
      return config;
    } catch (error) {
      this.logger.error('Failed to load configuration:', error);
      throw new Error('Failed to load server structure configuration');
    }
  }

  /**
   * Respect Discord rate limits
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
   * Main orchestration method to build complete server structure
   */
  async buildServer(): Promise<void> {
    try {
      this.logger.info(`🌌 Starting complete server build for: ${this.guild.name}`);
      this.logger.info('═'.repeat(60));

      // Step 1: Create Branding
      await this.createServerBranding();

      // Step 2: Create Roles
      await this.createRoles();

      // Step 3: Create Categories
      await this.createCategories();

      // Step 4: Create Channels
      await this.createChannels();

      // Step 5: Setup Permissions
      await this.setupPermissions();

      this.logger.info('═'.repeat(60));
      this.logger.info('✅ Server build completed successfully!');
      const summary = await this.getServerSummary();
      this.logger.info(summary);
    } catch (error) {
      this.logger.error('❌ Fatal error during server build:', error);
      throw error;
    }
  }

  /**
   * Create server branding (name and description)
   */
  async createServerBranding(): Promise<void> {
    try {
      this.logger.info('🎨 Step 1/5: Creating server branding...');

      await this.respectRateLimit();
      await this.guild.edit(
        {
          name: this.config.serverName,
          description: this.config.serverDescription,
        },
        'AI Universe Server Builder'
      );

      this.logger.info(`🌌 Server branded as: "${this.config.serverName}"`);
    } catch (error) {
      this.logger.error('Error creating server branding:', error);
      throw error;
    }
  }

  /**
   * Create all roles from configuration
   */
  async createRoles(): Promise<void> {
    try {
      this.logger.info('👑 Step 2/5: Creating roles with hierarchy...');

      const existingRoles = new Map(
        this.guild.roles.cache.map((r) => [r.name, r])
      );
      let createdCount = 0;
      let skippedCount = 0;

      for (const roleConfig of this.config.roles.hierarchy) {
        try {
          // Check if role already exists
          if (existingRoles.has(roleConfig.name)) {
            this.logger.info(`⏭️  Role exists: ${roleConfig.name}`);
            this.createdRoles.set(roleConfig.name, existingRoles.get(roleConfig.name)!);
            skippedCount++;
            continue;
          }

          await this.respectRateLimit();

          const role = await this.guild.roles.create({
            name: roleConfig.name,
            color: roleConfig.color,
            permissions: this.parsePermissions(roleConfig.permissions),
            hoist: roleConfig.hoist !== false,
            mentionable: roleConfig.mentionable !== false,
            reason: 'AI Universe Server Builder - Role Creation',
          });

          this.createdRoles.set(roleConfig.name, role);
          this.logger.info(`✅ Created role: ${roleConfig.name}`);
          createdCount++;
        } catch (error) {
          this.logger.error(`Failed to create role "${roleConfig.name}":`, error);
        }
      }

      this.logger.info(
        `📊 Roles complete - Created: ${createdCount}, Skipped: ${skippedCount}`
      );
    } catch (error) {
      this.logger.error('Error creating roles:', error);
      throw error;
    }
  }

  /**
   * Create all categories from configuration
   */
  async createCategories(): Promise<void> {
    try {
      this.logger.info('📂 Step 3/5: Creating categories...');

      const existingCategories = new Map(
        this.guild.channels.cache
          .filter((c) => c.type === ChannelType.GuildCategory)
          .map((c) => [c.name, c])
      );

      let createdCount = 0;
      let skippedCount = 0;

      for (const categoryConfig of this.config.categories) {
        try {
          let category: CategoryChannel | undefined;

          // Check if category already exists
          if (existingCategories.has(categoryConfig.name)) {
            category = existingCategories.get(categoryConfig.name) as CategoryChannel;
            this.logger.info(`⏭️  Category exists: ${categoryConfig.name}`);
            skippedCount++;
          } else {
            await this.respectRateLimit();

            category = (await this.guild.channels.create({
              name: categoryConfig.name,
              type: ChannelType.GuildCategory,
              position: categoryConfig.position,
              reason: 'AI Universe Server Builder - Category Creation',
            })) as CategoryChannel;

            this.logger.info(`✅ Created category: ${categoryConfig.name}`);
            createdCount++;
          }

          this.createdCategories.set(categoryConfig.id, category);
        } catch (error) {
          this.logger.error(
            `Failed to create category "${categoryConfig.name}":`,
            error
          );
        }
      }

      this.logger.info(
        `📊 Categories complete - Created: ${createdCount}, Skipped: ${skippedCount}`
      );
    } catch (error) {
      this.logger.error('Error creating categories:', error);
      throw error;
    }
  }

  /**
   * Create all channels from configuration
   */
  async createChannels(): Promise<void> {
    try {
      this.logger.info('🔧 Step 4/5: Creating channels...');

      let createdCount = 0;
      let skippedCount = 0;

      for (const categoryConfig of this.config.categories) {
        const category = this.createdCategories.get(categoryConfig.id);

        if (!category) {
          this.logger.warn(`Category not found for: ${categoryConfig.name}`);
          continue;
        }

        // Get existing channels in this category
        const existingChannels = new Map(
          this.guild.channels.cache
            .filter((c) => c.parentId === category.id)
            .map((c) => [c.name, c])
        );

        for (const channelConfig of categoryConfig.channels) {
          try {
            // Check if channel already exists
            if (existingChannels.has(channelConfig.name)) {
              this.logger.info(
                `⏭️  Channel exists: ${channelConfig.name}`
              );
              skippedCount++;
              continue;
            }

            await this.respectRateLimit();

            const channelType = this.getChannelType(channelConfig.type);
            const channel = await this.guild.channels.create({
              name: channelConfig.name,
              type: channelType,
              parent: category.id,
              topic: channelConfig.topic || channelConfig.description || undefined,
              nsfw: channelConfig.nsfw || false,
              reason: 'AI Universe Server Builder - Channel Creation',
            });

            this.createdChannels.set(
              `${category.name}/${channel.name}`,
              channel as TextChannel | VoiceChannel | ForumChannel | StageChannel
            );

            this.logger.info(`✅ Created ${channelConfig.type} channel: ${channelConfig.name}`);
            createdCount++;
          } catch (error) {
            this.logger.error(
              `Failed to create channel "${channelConfig.name}":`,
              error
            );
          }
        }
      }

      this.logger.info(
        `📊 Channels complete - Created: ${createdCount}, Skipped: ${skippedCount}`
      );
    } catch (error) {
      this.logger.error('Error creating channels:', error);
      throw error;
    }
  }

  /**
   * Setup permissions for channels and roles
   */
  async setupPermissions(): Promise<void> {
    try {
      this.logger.info('🔐 Step 5/5: Configuring permissions...');

      let configuredCount = 0;

      for (const categoryConfig of this.config.categories) {
        const category = this.createdCategories.get(categoryConfig.id);
        if (!category) continue;

        for (const channelConfig of categoryConfig.channels) {
          const channel = this.guild.channels.cache.find(
            (c) =>
              c.name === channelConfig.name &&
              c.parentId === category.id
          );

          if (!channel) continue;

          try {
            await this.respectRateLimit();

            // If channel is marked as private, restrict access
            if (channelConfig.private) {
              await this.setupPrivateChannelPermissions(channel);
            }

            // Apply custom permissions if specified
            if (channelConfig.permissions) {
              await this.applyCustomPermissions(
                channel,
                channelConfig.permissions
              );
            }

            this.logger.info(`🔐 Configured permissions: ${channelConfig.name}`);
            configuredCount++;
          } catch (error) {
            this.logger.error(
              `Failed to configure permissions for "${channelConfig.name}":`,
              error
            );
          }
        }
      }

      this.logger.info(`📊 Permissions configured for ${configuredCount} channels`);
    } catch (error) {
      this.logger.error('Error setting up permissions:', error);
      throw error;
    }
  }

  /**
   * Setup private channel permissions (restrict to staff only)
   */
  private async setupPrivateChannelPermissions(
    channel: ChannelResolvable
  ): Promise<void> {
    const staffRole = this.createdRoles.get('🛡️・Guardian Moderator');

    await this.respectRateLimit();

    // Remove @everyone access
    await this.guild.channels.cache.get(channel as string)?.permissionOverwrites.create(
      this.guild.roles.everyone,
      {
        ViewChannel: false,
        SendMessages: false,
        Connect: false,
      }
    );

    // Grant staff access
    if (staffRole) {
      await this.respectRateLimit();

      await this.guild.channels.cache.get(channel as string)?.permissionOverwrites.create(
        staffRole,
        {
          ViewChannel: true,
          SendMessages: true,
          Connect: true,
          ManageMessages: true,
          ManageChannels: true,
        }
      );
    }
  }

  /**
   * Apply custom permissions from configuration
   */
  private async applyCustomPermissions(
    channel: ChannelResolvable,
    permissions: { allow?: string[]; deny?: string[] }
  ): Promise<void> {
    const channelObj = this.guild.channels.cache.get(channel as string);
    if (!channelObj) return;

    const allowPerms = this.parsePermissions(permissions.allow || []);
    const denyPerms = this.parsePermissions(permissions.deny || []);

    await this.respectRateLimit();

    // Apply to everyone role
    await channelObj.permissionOverwrites.create(
      this.guild.roles.everyone,
      {
        allow: allowPerms,
        deny: denyPerms,
      }
    );
  }

  /**
   * Parse permission strings to Discord permission flags
   */
  private parsePermissions(permissions: string[]): bigint {
    let perms: bigint = 0n;

    const permissionMap: Record<string, bigint> = {
      administrator: PermissionFlagsBits.Administrator,
      manage_guild: PermissionFlagsBits.ManageGuild,
      manage_roles: PermissionFlagsBits.ManageRoles,
      manage_channels: PermissionFlagsBits.ManageChannels,
      manage_messages: PermissionFlagsBits.ManageMessages,
      manage_nicknames: PermissionFlagsBits.ManageNicknames,
      manage_webhooks: PermissionFlagsBits.ManageWebhooks,
      manage_emojis: PermissionFlagsBits.ManageEmojisAndStickers,
      manage_events: PermissionFlagsBits.ManageEvents,
      ban_members: PermissionFlagsBits.BanMembers,
      kick_members: PermissionFlagsBits.KickMembers,
      moderate_members: PermissionFlagsBits.ModerateMembers,
      send_messages: PermissionFlagsBits.SendMessages,
      view_channel: PermissionFlagsBits.ViewChannel,
      read_messages: PermissionFlagsBits.ViewChannel,
      embed_links: PermissionFlagsBits.EmbedLinks,
      attach_files: PermissionFlagsBits.AttachFiles,
      add_reactions: PermissionFlagsBits.AddReactions,
      use_slash_commands: PermissionFlagsBits.UseApplicationCommands,
      connect: PermissionFlagsBits.Connect,
      speak: PermissionFlagsBits.Speak,
      stream: PermissionFlagsBits.Stream,
      use_voice_activation: PermissionFlagsBits.UseVAD,
      priority_speaker: PermissionFlagsBits.PrioritySpeaker,
      mute_members: PermissionFlagsBits.MuteMembers,
      deafen_members: PermissionFlagsBits.DeafenMembers,
      move_members: PermissionFlagsBits.MoveMembers,
    };

    for (const perm of permissions) {
      if (permissionMap[perm]) {
        perms |= permissionMap[perm];
      }
    }

    return perms;
  }

  /**
   * Get Discord channel type from string configuration
   */
  private getChannelType(type: string): ChannelType {
    const typeMap: Record<string, ChannelType> = {
      text: ChannelType.GuildText,
      voice: ChannelType.GuildVoice,
      forum: ChannelType.GuildForum,
      stage: ChannelType.GuildStageVoice,
    };
    return typeMap[type] || ChannelType.GuildText;
  }

  /**
   * Get a summary of the created server structure
   */
  async getServerSummary(): Promise<string> {
    const categories = this.guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildCategory
    ).size;
    const textChannels = this.guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildText
    ).size;
    const voiceChannels = this.guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildVoice
    ).size;
    const forumChannels = this.guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildForum
    ).size;
    const roles = this.guild.roles.cache.size;

    return `
╔════════════════════════════════════════╗
║  🌌 AI UNIVERSE SERVER SUMMARY          ║
╠════════════════════════════════════════╣
║ 📂 Categories:      ${String(categories).padStart(25, ' ')} ║
║ 💬 Text Channels:   ${String(textChannels).padStart(25, ' ')} ║
║ 🎙️  Voice Channels:  ${String(voiceChannels).padStart(25, ' ')} ║
║ 💭 Forum Channels:  ${String(forumChannels).padStart(25, ' ')} ║
║ 👑 Roles:          ${String(roles).padStart(25, ' ')} ║
╚════════════���═══════════════════════════╝
    `;
  }

  /**
   * Reset the server structure (delete all created channels and roles)
   * ⚠️ WARNING: This is destructive and cannot be undone
   */
  async resetServerStructure(): Promise<void> {
    try {
      this.logger.warn('⚠️  Starting server reset...');
      this.logger.warn('This action cannot be undone!');

      // Delete all created channels
      for (const channel of this.createdChannels.values()) {
        try {
          await this.respectRateLimit();
          await channel.delete('Server reset by admin');
          this.logger.info(`🗑️  Deleted channel: ${channel.name}`);
        } catch (error) {
          this.logger.error(`Failed to delete channel ${channel.name}:`, error);
        }
      }

      // Delete all categories
      for (const category of this.createdCategories.values()) {
        try {
          await this.respectRateLimit();
          await category.delete('Server reset by admin');
          this.logger.info(`🗑️  Deleted category: ${category.name}`);
        } catch (error) {
          this.logger.error(`Failed to delete category ${category.name}:`, error);
        }
      }

      // Delete all created roles
      for (const role of this.createdRoles.values()) {
        try {
          await this.respectRateLimit();
          await role.delete('Server reset by admin');
          this.logger.info(`🗑️  Deleted role: ${role.name}`);
        } catch (error) {
          this.logger.error(`Failed to delete role ${role.name}:`, error);
        }
      }

      this.logger.info('✅ Server structure reset complete');
    } catch (error) {
      this.logger.error('Error resetting server structure:', error);
      throw error;
    }
  }

  /**
   * Get statistics about the server
   */
  getStatistics() {
    return {
      roles: {
        total: this.guild.roles.cache.size,
        created: this.createdRoles.size,
      },
      channels: {
        total: this.guild.channels.cache.size,
        created: this.createdChannels.size,
        categories: this.createdCategories.size,
      },
      members: this.guild.memberCount,
    };
  }
}

export default ServerBuilderSystem;
