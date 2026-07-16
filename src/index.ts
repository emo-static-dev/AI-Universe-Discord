import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { createLogger } from './utils/logger.js';
import { initializeHandlers } from './handlers/index.js';
import { ServerBuilderSystem } from './systems/ServerBuilderSystem.js';

// Load environment variables
dotenv.config();

// Setup path utilities for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
const logger = createLogger('BOT');

// Initialize Prisma Client
export const prisma = new PrismaClient();

// Create Discord.js Client with all intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember,
  ],
});

// Extend client with custom properties
declare global {
  namespace NodeJS {
    interface Global {
      client: typeof client;
      prisma: typeof prisma;
      logger: typeof logger;
    }
  }
}

// Store collections for commands and events
client.commands = new Collection();
client.events = new Collection();
client.cooldowns = new Collection();

/**
 * Main Bot Initialization
 */
async function main() {
  try {
    logger.info('🚀 Starting AI Universe Discord Bot...');

    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    // Initialize all handlers (commands, events)
    await initializeHandlers(client, __dirname);
    logger.info('✅ Event and command handlers loaded');

    // Login to Discord
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      throw new Error('DISCORD_TOKEN is not set in .env file');
    }

    await client.login(token);
    logger.info('✅ Bot logged in successfully');

  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

/**
 * Handle graceful shutdown
 */
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the bot
main();

export default client;
