const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Giveaway = require('../../models/Giveaway');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delgw')
        .setDescription('Delete a giveaway without picking winners')
        .addStringOption(option =>
            option.setName('giveaway_id')
                .setDescription('The ID of the giveaway to delete')
                .setRequired(true)),
    
    adminOnly: true,
    
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        
        const giveawayId = interaction.options.getString('giveaway_id');
        
        const giveaway = await Giveaway.findOne({ 
            giveawayId, 
            guildId: interaction.guild.id 
        });
        
        if (!giveaway) {
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('Not Found')
                .setDescription(`No giveaway found with ID: ${giveawayId}`);
            
            return interaction.editReply({ embeds: [errorEmbed] });
        }
        
        // Update status
        giveaway.status = 'cancelled';
        await giveaway.save();
        
        // Remove from memory
        client.giveaways.delete(giveawayId);
        
        // Try to delete the giveaway message
        try {
            const channel = await client.channels.fetch(giveaway.channelId);
            const message = await channel.messages.fetch(giveaway.messageId);
            
            const disabledEmbed = new PremiumEmbed(message.embeds[0].data)
                .setTitle(`❌ CANCELLED: ${giveaway.prize}`)
                .setDescription('This giveaway has been cancelled.')
                .setColor(0xFF0000);
            
            await message.edit({ embeds: [disabledEmbed], components: [] });
        } catch (error) {
            // Message might be deleted already
        }
        
        const successEmbed = new PremiumEmbed()
            .setSuccess()
            .setTitle('Giveaway Deleted')
            .setDescription(`Giveaway \`${giveawayId}\` has been deleted.`);
        
        await interaction.editReply({ embeds: [successEmbed] });
    }
};
