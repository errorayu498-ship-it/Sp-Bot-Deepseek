const { REST, Routes } = require('discord.js');
const { logger } = require('./logger');

module.exports = async (client) => {
    try {
        const commands = [];
        
        for (const command of client.slashCommands.values()) {
            if (command.data) {
                commands.push(command.data.toJSON());
            }
        }
        
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        logger.info(`Deploying ${commands.length} slash commands...`);
        
        // ✅ GLOBAL COMMANDS - Sabhi servers mein show hongi
        logger.info('Registering GLOBAL commands...');
        
        const globalData = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        
        logger.success(`Successfully deployed ${globalData.length} GLOBAL slash commands!`);
        
        // ✅ Also register to specific guild for instant updates (optional)
        if (process.env.GUILD_ID) {
            logger.info('Registering GUILD commands for instant updates...');
            
            const guildData = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            
            logger.success(`Successfully deployed ${guildData.length} GUILD slash commands!`);
        }
        
        logger.info('All commands registered successfully!');
        
    } catch (error) {
        logger.error('Failed to deploy slash commands:', error);
    }
};
