const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editinvites')
        .setDescription('Set a user\'s total invite count')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to edit invites for')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('New total invite count')
                .setRequired(true)
                .setMinValue(0)),
    
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
        const difference = amount - userData.invites.regular;
        
        userData.invites.total = amount;
        userData.invites.bonus = Math.max(0, difference);
        
        await userData.save();
        
        const embed = new PremiumEmbed()
            .setSuccess()
            .setTitle('Invites Updated')
            .setDescription(`Updated invite count for ${target.tag}`)
            .addField('Previous Total', oldInvites.toString(), true)
            .addField('New Total', amount.toString(), true)
            .addField('Regular Invites', userData.invites.regular.toString(), true)
            .addField('Bonus Invites', userData.invites.bonus.toString(), true);
        
        await interaction.editReply({ embeds: [embed] });
    }
};
