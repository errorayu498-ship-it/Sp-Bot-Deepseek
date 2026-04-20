const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addinvites')
        .setDescription('Add invites to a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to add invites to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of invites to add')
                .setRequired(true)
                .setMinValue(1)),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        
        let userData = await User.findOne({ 
            userId: target.id, 
            guildId: interaction.guild.id 
        });
        
        if (!userData) {
            userData = new User({
                userId: target.id,
                guildId: interaction.guild.id
            });
        }
        
        const oldInvites = userData.invites.total;
        userData.invites.total += amount;
        userData.invites.bonus += amount;
        
        await userData.save();
        
        const embed = new PremiumEmbed()
            .setSuccess()
            .setTitle('Invites Added')
            .setDescription(`Added ${amount} invites to ${target.tag}`)
            .addField('Previous Invites', oldInvites.toString(), true)
            .addField('New Total', userData.invites.total.toString(), true)
            .addField('Regular Invites', userData.invites.regular.toString(), true);
        
        await interaction.editReply({ embeds: [embed] });
    }
};
