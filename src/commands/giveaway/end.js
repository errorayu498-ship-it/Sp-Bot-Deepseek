const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const { GiveawayManager } = require('../../utils/giveawayManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('endgw')
        .setDescription('End a giveaway early')
        .addStringOption(option =>
            option.setName('giveaway_id')
                .setDescription('The ID of the giveaway to end')
                .setRequired(true)),
    
    adminOnly: true,
    
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        
        const giveawayId = interaction.options.getString('giveaway_id');
        
        const result = await GiveawayManager.endGiveaway(giveawayId, client, true);
        
        if (!result.success) {
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('Error')
                .setDescription(result.message);
            
            return interaction.editReply({ embeds: [errorEmbed] });
        }
        
        const successEmbed = new PremiumEmbed()
            .setSuccess()
            .setTitle('Giveaway Ended')
            .setDescription(`Giveaway \`${giveawayId}\` has been ended!`)
            .addField('Winners', result.winners.map(w => `<@${w.userId}>`).join('\n') || 'No entries');
        
        await interaction.editReply({ embeds: [successEmbed] });
    }
};
