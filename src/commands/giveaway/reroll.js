const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const { GiveawayManager } = require('../../utils/giveawayManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reroll')
        .setDescription('Reroll winners for an ended giveaway')
        .addStringOption(option =>
            option.setName('giveaway_id')
                .setDescription('The ID of the giveaway to reroll')
                .setRequired(true)),
    
    adminOnly: true,
    
    async execute(interaction, client) {
        await interaction.deferReply();
        
        const giveawayId = interaction.options.getString('giveaway_id');
        
        const result = await GiveawayManager.rerollGiveaway(giveawayId, interaction.guild.id);
        
        if (!result.success) {
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('Reroll Failed')
                .setDescription(result.message);
            
            return interaction.editReply({ embeds: [errorEmbed] });
        }
        
        const embed = new PremiumEmbed()
            .setSuccess()
            .setTitle('🎉 Giveaway Rerolled!')
            .setDescription(`New winners for **${result.giveaway.prize}**`)
            .addField('New Winners', result.winners.map(w => `<@${w.userId}>`).join('\n'))
            .setFooter({ text: `Giveaway ID: ${giveawayId} • Reroll #${result.giveaway.rerollCount}` });
        
        await interaction.editReply({ embeds: [embed] });
        
        // Announce in original channel
        const channel = await client.channels.fetch(result.giveaway.channelId);
        if (channel) {
            const announceEmbed = new PremiumEmbed()
                .setTitle('🎉 Giveaway Rerolled!')
                .setDescription(`The giveaway for **${result.giveaway.prize}** has been rerolled!`)
                .addField('New Winners', result.winners.map(w => `<@${w.userId}>`).join('\n'))
                .setFooter({ text: `Giveaway ID: ${giveawayId}` });
            
            await channel.send({ embeds: [announceEmbed] });
        }
    }
};
