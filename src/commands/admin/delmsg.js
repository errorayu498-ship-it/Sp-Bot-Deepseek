const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delmsg')
        .setDescription('Bulk delete messages from a channel')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('Delete messages only from this user (optional)')
                .setRequired(false)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const amount = interaction.options.getInteger('amount');
        const userId = interaction.options.getString('user_id');
        
        try {
            // Fetch messages
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            
            let messagesToDelete;
            
            if (userId) {
                // Filter messages from specific user
                messagesToDelete = messages
                    .filter(msg => msg.author.id === userId)
                    .first(amount);
                
                if (messagesToDelete.length === 0) {
                    const errorEmbed = new PremiumEmbed()
                        .setError()
                        .setTitle('❌ No Messages Found')
                        .setDescription(`No messages found from user ID: \`${userId}\` in the last 100 messages.`);
                    
                    return interaction.editReply({ embeds: [errorEmbed] });
                }
            } else {
                // Get the specified amount of messages
                messagesToDelete = messages.first(amount);
            }
            
            // Delete messages
            const deleted = await interaction.channel.bulkDelete(messagesToDelete, true);
            
            const embed = new PremiumEmbed()
                .setSuccess()
                .setTitle('✅ Messages Deleted')
                .setDescription(`Successfully deleted **${deleted.size}** messages!`)
                .addField('📊 Requested', amount.toString(), true)
                .addField('✅ Deleted', deleted.size.toString(), true)
                .addField('📺 Channel', `${interaction.channel}`, true);
            
            if (userId) {
                const target = await interaction.client.users.fetch(userId).catch(() => null);
                embed.addField('👤 Filtered User', target ? `${target.tag}` : userId, true);
            }
            
            embed.setFooter({ text: `Deleted by ${interaction.user.tag}` })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
            // Auto delete the confirmation after 5 seconds
            setTimeout(() => {
                interaction.deleteReply().catch(() => {});
            }, 5000);
            
        } catch (error) {
            console.error('Delete Messages Error:', error);
            
            let errorMessage = 'Failed to delete messages.';
            
            if (error.code === 50034) {
                errorMessage = 'You can only bulk delete messages that are under 14 days old.';
            } else if (error.code === 50013) {
                errorMessage = 'Missing permissions to delete messages.';
            }
            
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Error')
                .setDescription(errorMessage);
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
