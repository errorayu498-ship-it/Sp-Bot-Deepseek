const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Giveaway = require('../../models/Giveaway');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gwinfo')
        .setDescription('View giveaway information')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of giveaways to view')
                .setRequired(false)
                .addChoices(
                    { name: 'Active', value: 'active' },
                    { name: 'Ended', value: 'ended' },
                    { name: 'All', value: 'all' }
                )),
    
    adminOnly: true,
    
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        
        const type = interaction.options.getString('type') || 'active';
        
        let query = { guildId: interaction.guild.id };
        
        if (type === 'active') {
            query.status = 'active';
        } else if (type === 'ended') {
            query.status = 'ended';
        }
        
        const giveaways = await Giveaway.find(query)
            .sort({ createdAt: -1 })
            .limit(10);
        
        if (giveaways.length === 0) {
            const embed = new PremiumEmbed()
                .setInfo()
                .setTitle('Giveaway Info')
                .setDescription(`No ${type} giveaways found.`);
            
            return interaction.editReply({ embeds: [embed] });
        }
        
        const embed = new PremiumEmbed()
            .setTitle(`📊 ${type.charAt(0).toUpperCase() + type.slice(1)} Giveaways`)
            .setDescription(`Total: ${giveaways.length} giveaways shown`);
        
        for (const gw of giveaways) {
            const statusEmoji = gw.status === 'active' ? '🟢' : 
                               gw.status === 'ended' ? '🔴' : '⚫';
            
            embed.addField(
                `${statusEmoji} ${gw.prize}`,
                `**ID:** ${gw.giveawayId}\n` +
                `**Entries:** ${gw.entries.length}\n` +
                `**Winners:** ${gw.winners}\n` +
                `**Host:** <@${gw.hostId}>\n` +
                `**Status:** ${gw.status}`
            );
        }
        
        await interaction.editReply({ embeds: [embed] });
    }
};
