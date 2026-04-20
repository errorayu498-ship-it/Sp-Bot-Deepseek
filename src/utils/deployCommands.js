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
        
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        
        logger.success(`Successfully deployed ${data.length} slash commands!`);
        
    } catch (error) {
        logger.error('Failed to deploy slash commands:', error);
    }
};
