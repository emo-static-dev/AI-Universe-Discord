import {
  Client,
  Guild,
  CategoryChannel,
  TextChannel,
  VoiceChannel,
  ChannelType,
  PermissionFlagsBits,
  Role,
  OverwriteResolvable,
} from 'discord.js';
import { readFileSync } from 'fs';
import { createLogger } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('ServerBuilder');

interface Channel {
  name: string;
  type: 'text' | 'voice';
  description?: string;
  private?: boolean;
}

interface Category {
  id: string;
  name: string;
  channels: Channel[];
}

interface RoleConfig {
  name: string;
  color: string;
  permissions: string[];
  tier: string;
}

interface ServerStructure {
  serverName: string;
  serverDescription: string;
  categories: Category[];
  roles: {
    hierarchy: RoleConfig[];
  };
}

/**
 * Server Builder System
 * Handles automated creation of Discord server structure including:
 * - Categories with custom names and emojis
 * - Text and voice channels
 * - Roles with proper hierarchy
 * - Permission overwrites
 */
export class ServerBuilderSystem {
  private client: Client;
  private guild: Guild;
  private logger = logger;
  private config: ServerStructure;
  private createdRoles: Map<string, Role> = new Map();

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
   * Main method to build the entire server structure
   */
  async buildServerStructure(): Promise<void> {
    try {
      this.logger.info(`🚀 Starting server build for guild: ${this.guild.name}`);

      // Step 1: Create roles
      this.logger.info('📋 Step 1/3: Creating roles...');
      await this.createRoles();

      // Step 2: Create categories and channels
      this.logger.info('📂 Step 2/3: Creating categories and channels...');
      await this.createCategoriesAndChannels();

      // Step 3: Configure permissions
      this.logger.info('🔐 Step 3/3: Configuring permissions...');
      await this.configurePermissions();

      this.logger.info('✅ Server structure built successfully!');
    } catch (error) {
      this.logger.error('Error building server structure:', error);
      throw error;
    }
  }

  /**
   * Create all roles from configuration
   */
  private async createRoles(): Promise<void> {
    try {
      const existingRoles = new Set(this.guild.roles.cache.map((r) => r.name));

      for (const roleConfig of this.config.roles.hierarchy) {
        try {
          // Skip if role already exists
          if (existingRoles.has(roleConfig.name)) {
            this.logger.info(`⏭️  Role already exists: ${roleConfig.name}`);
            const existingRole = this.guild.roles.cache.find(
              (r) => r.name === roleConfig.name
            );
            if (existingRole) {
              this.createdRoles.set(roleConfig.name, existingRole);
            }
            continue;
          }

          // Create role with configuration
          const role = await this.guild.roles.create({
            name: roleConfig.name,
            color: roleConfig.color,
            permissions: this.parsePermissions(roleConfig.permissions),
            reason: 'AI Universe Server Builder',
          });

          this.createdRoles.set(roleConfig.name, role);
          this.logger.info(`✅ Created role: ${roleConfig.name}`);
        } catch (error) {
          this.logger.error(`Failed to create role ${roleConfig.name}:`, error);
        }
      }

      this.logger.info(
        `✅ Role creation complete. Total roles: ${this.createdRoles.size}`
      );
    } catch (error) {
      this.logger.error('Error creating roles:', error);
      throw error;
    }
  }

  /**
   * Create categories and channels
   */
  private async createCategoriesAndChannels(): Promise<void> {
    try {
      for (const categoryConfig of this.config.categories) {
        try {
          // Check if category already exists
          let category = this.guild.channels.cache.find(
            (c) => c.name === categoryConfig.name && c.type === ChannelType.GuildCategory
          ) as CategoryChannel | undefined;

          if (!category) {
            category = (await this.guild.channels.create({
              name: categoryConfig.name,
              type: ChannelType.GuildCategory,
              reason: 'AI Universe Server Builder',
            })) as CategoryChannel;
            this.logger.info(`✅ Created category: ${categoryConfig.name}`);
          } else {
            this.logger.info(`⏭️  Category already exists: ${categoryConfig.name}`);
          }

          // Create channels in this category
          await this.createChannelsInCategory(category, categoryConfig.channels);
        } catch (error) {
          this.logger.error(
            `Error creating category ${categoryConfig.name}:`,
            error
          );
        }
      }

      this.logger.info('✅ Category and channel creation complete');
    } catch (error) {
      this.logger.error('Error creating categories and channels:', error);
      throw error;
    }
  }

  /**
   * Create channels within a category
   */
  private async createChannelsInCategory(
    category: CategoryChannel,
    channelConfigs: Channel[]
  ): Promise<void> {
    for (const channelConfig of channelConfigs) {
      try {
        // Check if channel already exists
        const existingChannel = this.guild.channels.cache.find(
          (c) => c.name === channelConfig.name && c.parentId === category.id
        );

        if (existingChannel) {
          this.logger.info(`⏭️  Channel already exists: ${channelConfig.name}`);
          continue;
        }

        const channelType =
          channelConfig.type === 'voice'
            ? ChannelType.GuildVoice
            : ChannelType.GuildText;

        const channel = await this.guild.channels.create({
          name: channelConfig.name,
          type: channelType,
          parent: category.id,
          topic: channelConfig.description || undefined,
          reason: 'AI Universe Server Builder',
        });

        this.logger.info(`✅ Created channel: ${channelConfig.name}`);
      } catch (error) {
        this.logger.error(
          `Error creating channel ${channelConfig.name}:`,
          error
        );
      }
    }
  }

  /**
   * Configure channel permissions for staff and private channels
   */
  private async configurePermissions(): Promise<void> {
    try {
      const staffRole = this.createdRoles.get('🛡️・Guardian Moderator');
      const memberRole = this.guild.roles.cache.find(
        (r) => r.name === '⭐・Verified Member'
      );

      if (!staffRole) {
        this.logger.warn('Staff role not found, skipping permission configuration');
        return;
      }

      for (const category of this.config.categories) {
        const guildCategory = this.guild.channels.cache.find(
          (c) => c.name === category.name && c.type === ChannelType.GuildCategory
        );

        if (!guildCategory) continue;

        for (const channelConfig of category.channels) {
          if (!channelConfig.private) continue;

          const channel = this.guild.channels.cache.find(
            (c) =>
              c.name === channelConfig.name &&
              c.parentId === guildCategory.id
          );

          if (!channel) continue;

          try {
            // Remove @everyone permissions
            await channel.permissionOverwrites.create(
              this.guild.roles.everyone,
              {
                ViewChannel: false,
                SendMessages: false,
              }
            );

            // Grant staff access
            if (staffRole) {
              await channel.permissionOverwrites.create(staffRole, {
                ViewChannel: true,
                SendMessages: true,
                ManageMessages: true,
              });
            }

            this.logger.info(`🔐 Configured permissions for: ${channelConfig.name}`);
          } catch (error) {
            this.logger.error(
              `Error configuring permissions for ${channelConfig.name}:`,
              error
            );
          }
        }
      }

      this.logger.info('✅ Permission configuration complete');
    } catch (error) {
      this.logger.error('Error configuring permissions:', error);
      throw error;
    }
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
      ban_members: PermissionFlagsBits.BanMembers,
      kick_members: PermissionFlagsBits.KickMembers,
      moderate_members: PermissionFlagsBits.ModerateMembers,
      send_messages: PermissionFlagsBits.SendMessages,
      read_messages: PermissionFlagsBits.ViewChannel,
      view_channel: PermissionFlagsBits.ViewChannel,
      embed_links: PermissionFlagsBits.EmbedLinks,
      attach_files: PermissionFlagsBits.AttachFiles,
      add_reactions: PermissionFlagsBits.AddReactions,
      connect: PermissionFlagsBits.Connect,
      speak: PermissionFlagsBits.Speak,
      stream: PermissionFlagsBits.Stream,
    };

    for (const perm of permissions) {
      if (permissionMap[perm]) {
        perms |= permissionMap[perm];
      }
    }

    return perms;
  }

  /**
   * Get a summary of the created structure
   */
  async getSummary(): Promise<string> {
    const categories = this.guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildCategory
    ).size;
    const textChannels = this.guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildText
    ).size;
    const voiceChannels = this.guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildVoice
    ).size;
    const roles = this.guild.roles.cache.size;

    return `
📊 **AI Universe Server Summary**
├─ Categories: ${categories}
├─ Text Channels: ${textChannels}
├─ Voice Channels: ${voiceChannels}
└─ Roles: ${roles}
    `;
  }

  /**
   * Reset the server structure (delete all created channels and roles)
   * WARNING: This is destructive and cannot be undone
   */
  async resetServerStructure(): Promise<void> {
    try {
      this.logger.warn('⚠️  Starting server reset...');

      // Delete all channels in categories
      for (const category of this.config.categories) {
        const guildCategory = this.guild.channels.cache.find(
          (c) => c.name === category.name
        );
        if (guildCategory) {
          await guildCategory.delete('Server reset');
        }
      }

      // Delete all created roles
      for (const role of this.createdRoles.values()) {
        await role.delete('Server reset');
      }

      this.logger.info('✅ Server structure reset complete');
    } catch (error) {
      this.logger.error('Error resetting server structure:', error);
      throw error;
    }
  }
}

export default ServerBuilderSystem;
