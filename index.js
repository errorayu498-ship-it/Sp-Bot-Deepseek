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
    { name: 'Saraiki Bot', type: ActivityType.Playing },
    { name: 'Made By Subhan', type: ActivityType.Playing },
    { name: 'Powered By Saraiki-Plays', type: ActivityType.Playing },
    { name: 'CPU Usage 81%', type: ActivityType.Playing },
    { name: '@SARAIKI_PLAYS-S', type: ActivityType.Playing }
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
        
        // Register slash commands
        await require('./src/utils/deployCommands')(client);
        
        logger.success('Bot initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize bot:', error);
        process.exit(1);
    }
};

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

init();

module.exports = client;
