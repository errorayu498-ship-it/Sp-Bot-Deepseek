const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Guild = require('../../models/Guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addstaff')
        .setDescription('Add a member to staff (can use staff commands)')
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('The User ID to add as staff')
                .setRequired(true)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const userId = interaction.options.getString('user_id').trim();
        
        try {
            // Try to fetch user
            const target = await interaction.client.users.fetch(userId).catch(() => null);
            
            if (!target) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Invalid User ID')
                    .setDescription(`Could not find a user with ID: \`${userId}\``);
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Check if user is in the server
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            
            if (!member) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ User Not In Server')
                    .setDescription(`${target.tag} is not in this server!`);
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Get guild data
            let guildData = await Guild.findOne({ guildId: interaction.guild.id });
            
            if (!guildData) {
                guildData = new Guild({ 
                    guildId: interaction.guild.id, 
                    name: interaction.guild.name 
                });
            }
            
            // Initialize staff array if not exists
            if (!guildData.staff) {
                guildData.staff = [];
            }
            
            // Check if already staff
            const alreadyStaff = guildData.staff.some(s => s.userId === userId);
            
            if (alreadyStaff) {
                const errorEmbed = new PremiumEmbed()
                    .setWarning()
                    .setTitle('⚠️ Already Staff')
                    .setDescription(`${target.tag} is already a staff member!`);
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Add to staff
            guildData.staff.push({
                userId: userId,
                username: target.username,
                addedBy: interaction.user.id,
                addedAt: new Date()
            });
            
            await guildData.save();
            
            const embed = new PremiumEmbed()
                .setSuccess()
                .setTitle('✅ Staff Member Added')
                .setDescription(`${target.tag} has been added to the staff team!`)
                .addField('👤 User', `${target}`, true)
                .addField('🆔 User ID', userId, true)
                .addField('👮 Added By', `${interaction.user.tag}`, true)
                .addField('🔧 Staff Commands',
                    '• `.delmsg` - Delete messages\n' +
                    '• `.timeout` - Timeout members'
                )
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `Total Staff: ${guildData.staff.length}` })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
            // Log
            if (guildData.settings?.logChannel) {
                const { EmbedBuilder } = require('discord.js');
                const logEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('👮 Staff Member Added')
                    .setDescription(`${target.tag} has been added to staff!`)
                    .addFields(
                        { name: 'User', value: `${target.tag}`, inline: true },
                        { name: 'User ID', value: userId, inline: true },
                        { name: 'Added By', value: `${interaction.user.tag}`, inline: true }
                    )
                    .setTimestamp();
                
                const logChannel = await interaction.guild.channels.fetch(guildData.settings.logChannel).catch(() => null);
                if (logChannel) {
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }
            
        } catch (error) {
            console.error('Add Staff Error:', error);
            
            const errorEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Error')
                .setDescription('Failed to add staff member. Please try again.');
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
