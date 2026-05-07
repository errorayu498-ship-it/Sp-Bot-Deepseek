require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials, ActivityType } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { logger } = require('./src/utils/logger');
const { Database } = require('./src/utils/database');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction],
    allowedMentions: { parse: ['users', 'roles'], repliedUser: true }
});

client.commands = new Collection();
client.slashCommands = new Collection();
client.prefixCommands = new Collection();
client.giveaways = new Collection();
client.invites = new Collection();
client.cooldowns = new Collection();

// Status rotation
client.statuses = [
    { name: 'Made By Subhan', type: ActivityType.Watching },
    { name: 'Saraiki Bot, type: ActivityType.Watching },
    { name: 'Multi Server Supported', type: ActivityType.Watching },
    { name: '/help for commands', type: ActivityType.Playing },
    { name: 'Advanced Bot By Subhan', type: ActivityType.Competing }
];

// Load commands
const loadCommands = () => {
    const commandFolders = fs.readdirSync(path.join(__dirname, 'src/commands'));
    
    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(path.join(__dirname, `src/commands/${folder}`))
            .filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const command = require(`./src/commands/${folder}/${file}`);
            
            if (command.data) {
                client.slashCommands.set(command.data.name, command);
            }
            
            if (command.prefixData) {
                client.prefixCommands.set(command.prefixData.name, command);
            }
        }
    }
    
    logger.info(`Loaded ${client.slashCommands.size} slash commands and ${client.prefixCommands.size} prefix commands`);
};

// Load events
const loadEvents = () => {
    const eventFiles = fs.readdirSync(path.join(__dirname, 'src/events'))
        .filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const event = require(`./src/events/${file}`);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
    
    logger.info(`Loaded ${eventFiles.length} events`);
};

// Status rotation
let statusIndex = 0;
setInterval(() => {
    const status = client.statuses[statusIndex];
    client.user.setPresence({
        activities: [status],
        status: 'online'
    });
    statusIndex = (statusIndex + 1) % client.statuses.length;
}, 15000);

// Connect to MongoDB
Database.connect();

// Initialize bot
const init = async () => {
    try {
        loadCommands();
        loadEvents();
        
        await client.login(process.env.DISCORD_TOKEN);
        
        // ✅ Register slash commands globally
        await require('./src/utils/deployCommands')(client);
        
        logger.success('Bot initialized successfully');
        logger.info('Slash commands are now available in ALL servers!');
    } catch (error) {
        logger.error('Failed to initialize bot:', error);
        process.exit(1);
    }
};

// ✅ When bot joins a new server, commands will automatically be available
client.on('guildCreate', async (guild) => {
    logger.info(`Bot added to new server: ${guild.name} (${guild.id}) - Members: ${guild.memberCount}`);
    
    // Commands are already global, so they'll show up automatically
    // Just cache invites for the new server
    try {
        const invites = await guild.invites.fetch();
        client.invites.set(guild.id, new Map(invites.map(invite => [invite.code, invite.uses])));
        logger.info(`Cached ${invites.size} invites for ${guild.name}`);
    } catch (error) {
        logger.error(`Failed to cache invites for ${guild.name}:`, error);
    }
});

// ✅ When bot is removed from a server
client.on('guildDelete', async (guild) => {
    logger.info(`Bot removed from server: ${guild.name} (${guild.id})`);
    client.invites.delete(guild.id);
});

// Error handling
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.warn('Received SIGINT, shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.warn('Received SIGTERM, shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

init();

module.exports = client;
