const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    REST,
    Routes,
    SlashCommandBuilder,
    AttachmentBuilder
} = require('discord.js');
const transcripts = require('discord-html-transcripts');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(3000, () => console.log('Web server listening on port 3000'));

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
    console.error('Missing DISCORD_TOKEN environment variable');
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error('Missing CLIENT_ID environment variable');
    process.exit(1);
}

const configsDir = path.join(__dirname, 'configs');
if (!fs.existsSync(configsDir)) {
    fs.mkdirSync(configsDir, { recursive: true });
}

function defaultGuildConfig() {
    return { logsChannelId: null, staffRoleId: null, categoryRoles: {}, channelCategories: {}, channelOwners: {}, ticketCount: 0, totalTickets: 0, closedCount: 0, claims: {}, channelClaimants: {} };
}

function loadGuildConfig(guildId) {
    const file = path.join(configsDir, guildId + '.json');
    if (!fs.existsSync(file)) return defaultGuildConfig();
    try {
        return Object.assign(defaultGuildConfig(), JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch {
        return defaultGuildConfig();
    }
}

function saveGuildConfig(guildId, data) {
    const file = path.join(configsDir, guildId + '.json');
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function buildTranscript(channel, ticketNum) {
    return await transcripts.createTranscript(channel, {
        filename: 'ticket-' + ticketNum + '.html',
        saveImages: false,
        poweredBy: false
    });
}

function incrementGuildTicket(guildId) {
    const cfg = loadGuildConfig(guildId);
    cfg.ticketCount = (cfg.ticketCount || 0) + 1;
    cfg.totalTickets = (cfg.totalTickets || 0) + 1;
    saveGuildConfig(guildId, cfg);
    return cfg.totalTickets;
}

const commands = [
    new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('\u0625\u0631\u0633\u0627\u0644 \u0644\u0648\u062D\u0629 \u0646\u0638\u0627\u0645 \u0627\u0644\u062A\u0630\u0627\u0643\u0631')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('setup-logs')
        .setDescription('\u062A\u0639\u064A\u064A\u0646 \u0642\u0646\u0627\u0629 \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u062A\u0630\u0627\u0643\u0631')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('\u0627\u0644\u0642\u0646\u0627\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 (\u0627\u0641\u062A\u0631\u0627\u0636\u064A: \u0627\u0644\u0642\u0646\u0627\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('setup-staff')
        .setDescription('\u062A\u0639\u064A\u064A\u0646 \u0631\u062A\u0628\u0629 \u0637\u0627\u0642\u0645 \u0639\u0627\u0645 (\u0627\u062D\u062A\u064A\u0627\u0637\u064A)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(opt =>
            opt.setName('role')
                .setDescription('\u0631\u062A\u0628\u0629 \u0627\u0644\u0637\u0627\u0642\u0645')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('setup-category')
        .setDescription('\u062A\u062E\u0635\u064A\u0635 \u0631\u062A\u0628\u0629 \u0644\u0642\u0633\u0645 \u062A\u0630\u0627\u0643\u0631 \u0645\u0639\u064A\u0646')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('ticket-stats')
        .setDescription('\u0639\u0631\u0636 \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u062A\u0630\u0627\u0643\u0631')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('reset-stats')
        .setDescription('\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u062A\u0630\u0627\u0643\u0631')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('remove-user')
        .setDescription('\u0625\u0632\u0627\u0644\u0629 \u0639\u0636\u0648 \u0645\u0646 \u0642\u0646\u0627\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('\u0627\u0644\u0639\u0636\u0648 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u0632\u0627\u0644\u062A\u0647')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('close-ticket')
        .setDescription('\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629'),

    new SlashCommandBuilder()
        .setName('add-user')
        .setDescription('\u0625\u0636\u0627\u0641\u0629 \u0639\u0636\u0648 \u0625\u0644\u0649 \u0642\u0646\u0627\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('\u0627\u0644\u0639\u0636\u0648 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u0636\u0627\u0641\u062A\u0647')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('rename-ticket')
        .setDescription('\u062A\u063A\u064A\u064A\u0631 \u0627\u0633\u0645 \u0642\u0646\u0627\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u062C\u062F\u064A\u062F \u0644\u0644\u0642\u0646\u0627\u0629')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('\u0639\u0631\u0636 \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0645\u062A\u0627\u062D\u0629')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('staff-help')
        .setDescription('\u0639\u0631\u0636 \u0623\u0648\u0627\u0645\u0631 \u0641\u0631\u064A\u0642 \u0627\u0644\u062F\u0639\u0645'),
].map(cmd => cmd.toJSON());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.on('error', (error) => {
    console.error('Client error:', error.message);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error.message);
});

client.once('ready', async () => {
    console.log('Ready: ' + client.user.tag);
    try {
        const rest = new REST().setToken(TOKEN);
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Slash commands registered globally.');
    } catch (err) {
        console.error('Failed to register slash commands:', err.message);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;

    // ─── Slash Commands ───────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'ticket') {
            const bannerPath = path.join(__dirname, 'assets', 'banner.webp');
            const hasBanner = fs.existsSync(bannerPath);

            // \u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u062A\u0630\u0627\u0643\u0631 — \u062A\u0645 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0625\u0645\u0644\u0627\u0621 \u0628\u0639\u0646\u0627\u064A\u0629
            const desc = [
                '\u062A\u062D\u062A\u0627\u062C \u0645\u0633\u0627\u0639\u062F\u0629 \u061F',
                '',
                '\u2022 \u0627\u062E\u062A\u0631 \u062A\u0630\u0643\u0631\u0629 \u062D\u0633\u0628 \u0646\u0648\u0639 \u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0629 \u0627\u0644\u0644\u064A \u062A\u062D\u062A\u0627\u062C\u0647\u0627',
                '',
                ': \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0645\u0647\u0645\u0629',
                '',
                '\u2022 \u0627\u0644\u0627\u0644\u062A\u0632\u0627\u0645 \u0641\u064A \u0627\u0642\u0633\u0627\u0645 \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0648\u0639\u062F\u0645 \u062A\u062E\u0637\u064A \u0627\u0642\u0633\u0627\u0645 \u0627\u0644\u0627\u062F\u0627\u0631\u0629',
                '\u2022 \u064A\u0645\u0646\u0639 \u0641\u0643 \u062A\u0643\u062A \u0628\u063A\u0631\u0636 \u0627\u0644\u062C\u062F\u0648\u0644\u0629 \u0648 \u0627\u0644\u0645\u0632\u062D',
                '\u2022 \u0627\u062D\u062A\u0631\u0627\u0645 \u0627\u0644\u0627\u062F\u0627\u0631\u0629 \u0648\u0639\u0631\u0636 \u0645\u0634\u0643\u0644\u062A\u0643 \u0628\u0643\u0644 \u0627\u062D\u062A\u0631\u0627\u0645',
                '\u2022 \u064A\u0645\u0646\u0639 \u0627\u0644\u062A\u0644\u0627\u0639\u0628 \u0628\u0627\u0644\u0634\u0643\u0627\u0648\u064A'
            ].join('\n');

            const embed = new EmbedBuilder()
                .setTitle('دلــه')
                .setDescription(desc)
                .setColor(0x5865F2)
                .setFooter({ text: '\u0627\u062E\u062A\u0631 \u0641\u0626\u0629 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0623\u062F\u0646\u0627\u0647 \u0644\u0641\u062A\u062D \u062A\u0630\u0643\u0631\u062A\u0643 \u2B07\uFE0F' });

            if (hasBanner) embed.setImage('attachment://banner.webp');

            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket-menu')
                .setPlaceholder('\u0627\u062E\u062A\u0631 \u0641\u0626\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629')
                .addOptions([
                    { label: '\u062F\u0639\u0645 \u0641\u0646\u064A', description: '\u0644\u0637\u0644\u0628 \u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0629 \u0648\u0627\u0644\u0634\u0643\u0627\u0648\u064A \u0648\u0627\u0644\u0627\u0633\u062A\u0641\u0633\u0627\u0631\u0627\u062A', value: 'tech-support', emoji: '\u2699\uFE0F' },
                    { label: '\u0642\u0633\u0645 \u0627\u0644\u0641\u0639\u0627\u0644\u064A\u0627\u062A', description: '\u062C\u0645\u064A\u0639 \u0645\u0627 \u064A\u062E\u0635 \u0627\u0644\u0641\u0639\u0627\u0644\u064A\u0627\u062A \u0648\u0627\u0644\u0627\u0641\u0646\u062A', value: 'events', emoji: '\uD83C\uDFA1' },
                    { label: '\u0642\u0633\u0645 \u0627\u0644\u0623\u0644\u0639\u0627\u0628', description: '\u0644\u0637\u0644\u0628 \u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0629 \u0627\u0644\u0645\u062E\u062A\u0635\u0629 \u0628\u0642\u0633\u0645 \u0627\u0644\u0623\u0644\u0639\u0627\u0628', value: 'games', emoji: '\uD83C\uDFAE' },
                    { label: '\u062F\u0639\u0645 \u0639\u0644\u064A\u0627', description: '\u0627\u0644\u0634\u0643\u0627\u0648\u064A \u0639\u0644\u0649 \u0627\u0644\u0627\u062F\u0627\u0631\u064A\u064A\u0646', value: 'vip-support', emoji: '\uD83D\uDD27' },
                    { label: '\u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643\u0627\u062A \u0648\u0627\u0644\u0627\u0639\u0644\u0627\u0646', description: '\u0642\u0633\u0645 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643\u0627\u062A \u0648\u062A\u062C\u062F\u064A\u062F\u0647\u0627 \u0648\u0627\u0644\u0627\u0639\u0644\u0627\u0646\u0627\u062A', value: 'subscriptions', emoji: '\uD83D\uDCB0' }
                ]);

            const row = new ActionRowBuilder().addComponents(menu);
            const files = hasBanner ? [new AttachmentBuilder(bannerPath, { name: 'banner.webp' })] : [];
            await interaction.reply({ embeds: [embed], components: [row], files });
            return;
        }

        if (commandName === 'setup-logs') {
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            const cfg = loadGuildConfig(guildId);
            cfg.logsChannelId = targetChannel.id;
            saveGuildConfig(guildId, cfg);

            const embed = new EmbedBuilder()
                .setDescription(
                    '\u2705 \u062A\u0645 \u062A\u0639\u064A\u064A\u0646 <#' + targetChannel.id + '> \u0643\u0642\u0646\u0627\u0629 \u0633\u062C\u0644\u0627\u062A \u0644\u0647\u0630\u0627 \u0627\u0644\u0633\u064A\u0631\u0641\u064A\u0631.'
                )
                .setColor(0x57F287);

            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        if (commandName === 'setup-staff') {
            const role = interaction.options.getRole('role');
            const cfg = loadGuildConfig(guildId);
            cfg.staffRoleId = role.id;
            saveGuildConfig(guildId, cfg);

            const embed = new EmbedBuilder()
                .setDescription(
                    '\u2705 \u062A\u0645 \u062A\u0639\u064A\u064A\u0646 <@&' + role.id + '> \u0643\u0631\u062A\u0628\u0629 \u0637\u0627\u0642\u0645 \u0627\u0644\u062F\u0639\u0645 \u0644\u0647\u0630\u0627 \u0627\u0644\u0633\u064A\u0631\u0641\u064A\u0631.'
                )
                .setColor(0x57F287);

            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        if (commandName === 'setup-category') {
            const catEmbed = new EmbedBuilder()
                .setTitle('\u2699\uFE0F \u062A\u062E\u0635\u064A\u0635 \u0642\u0633\u0645')
                .setDescription('\u0627\u062E\u062A\u0631 \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0630\u064A \u062A\u0628\u064A \u062A\u062E\u0635\u064A\u0635 \u0631\u062A\u0628\u0629 \u0644\u0647:')
                .setColor(0x5865F2);

            const catMenu = new StringSelectMenuBuilder()
                .setCustomId('setup-category-select')
                .setPlaceholder('\u0627\u062E\u062A\u0631 \u0627\u0644\u0642\u0633\u0645...')
                .addOptions([
                    { label: '\u062F\u0639\u0645 \u0641\u0646\u064A', value: 'tech-support', emoji: '\u2699\uFE0F' },
                    { label: '\u0642\u0633\u0645 \u0627\u0644\u0641\u0639\u0627\u0644\u064A\u0627\u062A', value: 'events', emoji: '\uD83C\uDFA1' },
                    { label: '\u0642\u0633\u0645 \u0627\u0644\u0623\u0644\u0639\u0627\u0628', value: 'games', emoji: '\uD83C\uDFAE' },
                    { label: '\u062F\u0639\u0645 \u0639\u0644\u064A\u0627', value: 'vip-support', emoji: '\uD83D\uDD27' },
                    { label: '\u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643\u0627\u062A \u0648\u0627\u0644\u0627\u0639\u0644\u0627\u0646', value: 'subscriptions', emoji: '\uD83D\uDCB0' }
                ]);

            await interaction.reply({
                embeds: [catEmbed],
                components: [new ActionRowBuilder().addComponents(catMenu)],
                flags: 64
            });
            return;
        }

        if (commandName === 'ticket-stats') {
            const cfg = loadGuildConfig(guildId);
            const opened = cfg.ticketCount || 0;
            const closed = cfg.closedCount || 0;
            const claimsData = cfg.claims || {};

            const sortedClaims = Object.entries(claimsData)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            let claimsValue = '\u0644\u0627 \u064A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0639\u062F';
            if (sortedClaims.length > 0) {
                claimsValue = sortedClaims
                    .map((entry, i) => (i + 1) + '. <@' + entry[0] + '> \u2014 **' + entry[1] + '** \u0627\u0633\u062A\u0644\u0627\u0645')
                    .join('\n');
            }

            const statsEmbed = new EmbedBuilder()
                .setTitle('\uD83D\uDCCA \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u062A\u0630\u0627\u0643\u0631')
                .addFields(
                    { name: '\uD83D\uDCE5 \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u0645\u0641\u062A\u0648\u062D\u0629', value: String(opened), inline: true },
                    { name: '\uD83D\uDD12 \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u0645\u063A\u0644\u0642\u0629', value: String(closed), inline: true },
                    { name: '\uD83D\uDFE1 \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u0646\u0634\u0637\u0629', value: String(Math.max(0, opened - closed)), inline: true },
                    { name: '\uD83D\uDC64 \u0623\u0643\u062B\u0631 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0627\u0633\u062A\u0644\u0627\u0645\u0627\u064B', value: claimsValue }
                )
                .setColor(0x5865F2)
                .setTimestamp();

            await interaction.reply({ embeds: [statsEmbed], flags: 64 });
            return;
        }

        if (commandName === 'reset-stats') {
            const cfg = loadGuildConfig(guildId);
            cfg.ticketCount = 0;
            cfg.closedCount = 0;
            cfg.claims = {};
            saveGuildConfig(guildId, cfg);

            const embed = new EmbedBuilder()
                .setDescription(
                    '\u2705 \u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u062C\u0645\u064A\u0639 \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0644\u0647\u0630\u0627 \u0627\u0644\u0633\u064A\u0631\u0641\u064A\u0631.'
                )
                .setColor(0xED4245)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        if (commandName === 'close-ticket') {
            const channel = interaction.channel;
            const cfg = loadGuildConfig(guildId);
            const closer = interaction.member;
            const isAdmin = closer.permissions.has(PermissionFlagsBits.Administrator);
            const hasStaffRole = cfg.staffRoleId && closer.roles.cache.has(cfg.staffRoleId);

            if (!isAdmin && !hasStaffRole) {
                await interaction.reply({ content: '\u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631 \u0644\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0641\u0642\u0637.', flags: 64 });
                return;
            }

            const claimantId = cfg.channelClaimants && cfg.channelClaimants[channel.id];
            if (claimantId && !isAdmin && closer.id !== claimantId) {
                await interaction.reply({
                    content: '\u274C \u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0625\u063A\u0644\u0627\u0642 \u0647\u0630\u0647 \u0627\u0644\u062A\u0630\u0643\u0631\u0629. \u0641\u0642\u0637 \u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0630\u064A \u0627\u0633\u062A\u0644\u0645\u0647\u0627 (<@' + claimantId + '>) \u0623\u0648 \u0627\u0644\u0645\u0634\u0631\u0641 \u064A\u0645\u0643\u0646\u0647 \u0630\u0644\u0643.',
                    flags: 64
                });
                return;
            }

            const channelName = channel.name;
            const ticketNum = channelName.replace(/[^0-9]/g, '') || '?';
            const ownerId = cfg.channelOwners && cfg.channelOwners[channel.id];

            try {
                await interaction.deferReply();
            } catch {
                return;
            }

            const ownerTag = ownerId ? (await interaction.guild.members.fetch(ownerId).catch(() => null))?.user?.tag : null;
            const claimantTag = claimantId ? (await interaction.guild.members.fetch(claimantId).catch(() => null))?.user?.tag : null;
            const transcript = await buildTranscript(channel, ticketNum);

            if (cfg.logsChannelId) {
                const logsChannel = channel.guild.channels.cache.get(cfg.logsChannelId);
                if (logsChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('\uD83D\uDCCB \u0633\u062C\u0644 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 #' + ticketNum)
                        .addFields(
                            { name: '\uD83D\uDC64 \u0635\u0627\u062D\u0628 \u0627\u0644\u062A\u0630\u0643\u0631\u0629', value: ownerId ? '<@' + ownerId + '>' : '\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641', inline: true },
                            { name: '\uD83D\uDD12 \u0623\u063A\u0644\u0642\u0647\u0627', value: closer ? '<@' + closer.id + '>' : '\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641', inline: true },
                            { name: '\uD83D\uDCC1 \u0627\u0644\u0642\u0646\u0627\u0629', value: channelName, inline: true }
                        )
                        .setColor(0xED4245)
                        .setTimestamp();

                    await logsChannel.send({ embeds: [logEmbed], files: [transcript] });
                }
            }

            const closeCfg = loadGuildConfig(guildId);
            closeCfg.closedCount = (closeCfg.closedCount || 0) + 1;
            if (closeCfg.channelClaimants) delete closeCfg.channelClaimants[channel.id];
            if (closeCfg.channelOwners) delete closeCfg.channelOwners[channel.id];
            saveGuildConfig(guildId, closeCfg);

            const closeEmbed = new EmbedBuilder()
                .setTitle('\uD83D\uDD12 \u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062A\u0630\u0643\u0631\u0629')
                .setDescription('\u0633\u064A\u062A\u0645 \u062D\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u0642\u0646\u0627\u0629 \u062E\u0644\u0627\u0644 5 \u062B\u0648\u0627\u0646.')
                .setColor(0xED4245)
                .setTimestamp();

            await interaction.editReply({ embeds: [closeEmbed] });
            setTimeout(async () => { await channel.delete().catch(() => null); }, 5000);
            return;
        }

        if (commandName === 'remove-user') {
            const channel = interaction.channel;
            const cfg = loadGuildConfig(guildId);
            const requester = interaction.member;
            const isAdmin = requester.permissions.has(PermissionFlagsBits.Administrator);
            const hasStaffRole = cfg.staffRoleId && requester.roles.cache.has(cfg.staffRoleId);

            if (!isAdmin && !hasStaffRole) {
                await interaction.reply({ content: '\u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631 \u0644\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0641\u0642\u0637.', flags: 64 });
                return;
            }

            const targetUser = interaction.options.getUser('user');
            const ownerId = cfg.channelOwners && cfg.channelOwners[channel.id];
            const claimantId = cfg.channelClaimants && cfg.channelClaimants[channel.id];

            if (targetUser.id === ownerId) {
                await interaction.reply({ content: '\u274C \u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0632\u0627\u0644\u0629 \u0635\u0627\u062D\u0628 \u0627\u0644\u062A\u0630\u0643\u0631\u0629.', flags: 64 });
                return;
            }

            if (targetUser.id === claimantId) {
                await interaction.reply({ content: '\u274C \u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0645\u0633\u062A\u0644\u0645 \u0644\u0644\u062A\u0630\u0643\u0631\u0629.', flags: 64 });
                return;
            }

            const overwrite = channel.permissionOverwrites.cache.get(targetUser.id);
            if (!overwrite) {
                await interaction.reply({ content: '\u274C \u0647\u0630\u0627 \u0627\u0644\u0639\u0636\u0648 \u0644\u064A\u0633 \u0645\u0636\u0627\u0641\u0627\u064B \u0644\u0644\u062A\u0630\u0643\u0631\u0629.', flags: 64 });
                return;
            }

            await channel.permissionOverwrites.delete(targetUser.id);

            const embed = new EmbedBuilder()
                .setDescription('\u2705 \u062A\u0645 \u0625\u0632\u0627\u0644\u0629 <@' + targetUser.id + '> \u0645\u0646 \u0627\u0644\u062A\u0630\u0643\u0631\u0629.')
                .setColor(0xED4245);

            await interaction.reply({ embeds: [embed] });
            return;
        }

        if (commandName === 'add-user') {
            const channel = interaction.channel;
            const cfg = loadGuildConfig(guildId);
            const requester = interaction.member;
            const isAdmin = requester.permissions.has(PermissionFlagsBits.Administrator);
            const hasStaffRole = cfg.staffRoleId && requester.roles.cache.has(cfg.staffRoleId);
            const isTicketOwner = cfg.channelOwners && cfg.channelOwners[channel.id] === requester.id;

            if (!isAdmin && !hasStaffRole && !isTicketOwner) {
                await interaction.reply({ content: '\u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631 \u0644\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0648\u0635\u0627\u062D\u0628 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0641\u0642\u0637.', flags: 64 });
                return;
            }

            const targetUser = interaction.options.getUser('user');
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!targetMember) {
                await interaction.reply({ content: '\u274C \u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0639\u0636\u0648.', flags: 64 });
                return;
            }

            await channel.permissionOverwrites.edit(targetMember.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            const embed = new EmbedBuilder()
                .setDescription('\u2705 \u062A\u0645 \u0625\u0636\u0627\u0641\u0629 <@' + targetUser.id + '> \u0625\u0644\u0649 \u0627\u0644\u062A\u0630\u0643\u0631\u0629.')
                .setColor(0x57F287);

            await interaction.reply({ embeds: [embed] });
            return;
        }

        if (commandName === 'remove-user') {
            const channel = interaction.channel;
            const cfg = loadGuildConfig(guildId);
            const requester = interaction.member;
            const isAdmin = requester.permissions.has(PermissionFlagsBits.Administrator);
            const hasStaffRole = cfg.staffRoleId && requester.roles.cache.has(cfg.staffRoleId);
            const isTicketOwner = cfg.channelOwners && cfg.channelOwners[channel.id] === requester.id;

            if (!isAdmin && !hasStaffRole && !isTicketOwner) {
                await interaction.reply({ content: '\u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631 \u0644\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0648\u0635\u0627\u062D\u0628 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0641\u0642\u0637.', flags: 64 });
                return;
            }

            const targetUser = interaction.options.getUser('user');
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!targetMember) {
                await interaction.reply({ content: '\u274C \u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0639\u0636\u0648.', flags: 64 });
                return;
            }

            if (cfg.channelOwners && cfg.channelOwners[channel.id] === targetUser.id) {
                await interaction.reply({ content: '\u274C \u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0632\u0627\u0644\u0629 \u0635\u0627\u062D\u0628 \u0627\u0644\u062A\u0630\u0643\u0631\u0629.', flags: 64 });
                return;
            }

            await channel.permissionOverwrites.edit(targetMember.id, {
                ViewChannel: false,
                SendMessages: false,
                ReadMessageHistory: false
            });

            const removeEmbed = new EmbedBuilder()
                .setDescription('\u274C \u062A\u0645 \u0625\u0632\u0627\u0644\u0629 <@' + targetUser.id + '> \u0645\u0646 \u0627\u0644\u062A\u0630\u0643\u0631\u0629.')
                .setColor(0xED4245);

            await interaction.reply({ embeds: [removeEmbed] });
            return;
        }

        if (commandName === 'rename-ticket') {
            const channel = interaction.channel;
            const cfg = loadGuildConfig(guildId);
            const requester = interaction.member;
            const isAdmin = requester.permissions.has(PermissionFlagsBits.Administrator);
            const hasStaffRole = cfg.staffRoleId && requester.roles.cache.has(cfg.staffRoleId);
            const claimantId = cfg.channelClaimants && cfg.channelClaimants[channel.id];

            if (!isAdmin && !hasStaffRole && requester.id !== claimantId) {
                await interaction.reply({ content: '\u274C \u0641\u0642\u0637 \u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0645\u0633\u062A\u0644\u0645 \u0644\u0647\u0630\u0647 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0623\u0648 \u0627\u0644\u0645\u0634\u0631\u0641 \u064A\u0645\u0643\u0646\u0647 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0627\u0633\u0645.', flags: 64 });
                return;
            }

            const newName = interaction.options.getString('name')
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9\u0600-\u06ff\-]/g, '')
                .slice(0, 100);

            if (!newName) {
                await interaction.reply({ content: '\u274C \u0627\u0644\u0627\u0633\u0645 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.', flags: 64 });
                return;
            }

            const oldName = channel.name;
            await channel.setName(newName).catch(() => null);

            const embed = new EmbedBuilder()
                .setDescription('\u270F\uFE0F \u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0627\u0633\u0645 \u0627\u0644\u0642\u0646\u0627\u0629 \u0645\u0646 `' + oldName + '` \u0625\u0644\u0649 `' + newName + '`.')
                .setColor(0x5865F2)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            return;
        }

        if (commandName === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setTitle('\uD83D\uDCCB \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0648\u0627\u0645\u0631')
                .addFields(
                    { name: '`/ticket`', value: '\u0625\u0631\u0633\u0627\u0644 \u0644\u0648\u062D\u0629 \u0627\u062E\u062A\u064A\u0627\u0631 \u0646\u0648\u0639 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0644\u0644\u0642\u0646\u0627\u0629' },
                    { name: '`/setup-logs`', value: '\u062A\u0639\u064A\u064A\u0646 \u0642\u0646\u0627\u0629 \u0625\u0631\u0633\u0627\u0644 \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u0645\u063A\u0644\u0642\u0629' },
                    { name: '`/setup-staff`', value: '\u062A\u0639\u064A\u064A\u0646 \u0631\u062A\u0628\u0629 \u0637\u0627\u0642\u0645 \u0639\u0627\u0645 \u0644\u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0642\u0633\u0627\u0645 (\u0627\u062D\u062A\u064A\u0627\u0637\u064A)' },
                    { name: '`/setup-category`', value: '\u062A\u062E\u0635\u064A\u0635 \u0631\u062A\u0628\u0629 \u0645\u0639\u064A\u0646\u0629 \u0644\u0643\u0644 \u0642\u0633\u0645 \u2014 \u0641\u0642\u0637 \u0631\u0627\u0639\u064A \u0627\u0644\u0642\u0633\u0645 \u064A\u0634\u0648\u0641 \u062A\u0630\u0627\u0643\u0631\u0647' },
                    { name: '`/close-ticket`', value: '\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u2014 \u0644\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0645\u0633\u062A\u0644\u0645 \u0623\u0648 \u0627\u0644\u0645\u0634\u0631\u0641 \u0641\u0642\u0637' },
                    { name: '`/rename-ticket`', value: '\u062A\u063A\u064A\u064A\u0631 \u0627\u0633\u0645 \u0642\u0646\u0627\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u2014 \u0644\u0644\u0645\u0633\u062A\u0644\u0645 \u0623\u0648 \u0627\u0644\u0645\u0634\u0631\u0641 \u0641\u0642\u0637' },
                    { name: '`/add-user`', value: '\u0625\u0636\u0627\u0641\u0629 \u0639\u0636\u0648 \u0625\u0644\u0649 \u0642\u0646\u0627\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629' },
                    { name: '`/remove-user`', value: '\u0625\u0632\u0627\u0644\u0629 \u0639\u0636\u0648 \u062A\u0645\u062A \u0625\u0636\u0627\u0641\u062A\u0647 \u0645\u0646 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 (\u0644\u0627 \u064A\u0637\u0628\u0642 \u0639\u0644\u0649 \u0635\u0627\u062D\u0628\u0647\u0627 \u0623\u0648 \u0645\u0633\u062A\u0644\u0645\u0647\u0627)' },
                    { name: '`/ticket-stats`', value: '\u0639\u0631\u0636 \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0644\u0647\u0630\u0627 \u0627\u0644\u0633\u064A\u0631\u0641\u064A\u0631' },
                    { name: '`/reset-stats`', value: '\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0627\u0644\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A (\u0644\u0627 \u064A\u0645\u0633\u062D \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A)' },
                    { name: '`/help`', value: '\u0639\u0631\u0636 \u0647\u0630\u0647 \u0627\u0644\u0642\u0627\u0626\u0645\u0629' }
                )
                .setColor(0x5865F2)
                .setFooter({ text: '\u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0648\u0627\u0645\u0631 \u0644\u0644\u0645\u0634\u0631\u0641\u064A\u0646 \u0641\u0642\u0637' })
                .setTimestamp();

            await interaction.reply({ embeds: [helpEmbed], flags: 64 });
            return;
        }

        if (commandName === 'staff-help') {
            const cfg = loadGuildConfig(guildId);
            const member = interaction.member;
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
            const hasStaffRole = cfg.staffRoleId && member.roles.cache.has(cfg.staffRoleId);

            const hasCategoryRole = cfg.categoryRoles && Object.values(cfg.categoryRoles).some(rid => member.roles.cache.has(rid));

            if (!isAdmin && !hasStaffRole && !hasCategoryRole) {
                await interaction.reply({ content: '\u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631 \u0644\u0641\u0631\u064A\u0642 \u0627\u0644\u062F\u0639\u0645 \u0641\u0642\u0637.', flags: 64 });
                return;
            }

            const staffEmbed = new EmbedBuilder()
                .setTitle('\uD83D\uDCCB \u0623\u0648\u0627\u0645\u0631 \u0641\u0631\u064A\u0642 \u0627\u0644\u062F\u0639\u0645')
                .setDescription('\u0647\u0630\u0647 \u0627\u0644\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0644\u0643 \u062F\u0627\u062E\u0644 \u0627\u0644\u062A\u0630\u0627\u0643\u0631:')
                .addFields(
                    { name: '\uD83D\uDD35 \u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u062A\u0630\u0643\u0631\u0629', value: '\u0627\u0636\u063A\u0637 \u0632\u0631 **\u0627\u0633\u062A\u0644\u0645** \u062F\u0627\u062E\u0644 \u0623\u064A \u062A\u0630\u0643\u0631\u0629 \u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0633\u0645\u0643 \u0643\u0645\u0633\u062A\u0644\u0645' },
                    { name: '`/close-ticket`', value: '\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0648\u062D\u0641\u0638 \u0633\u062C\u0644 \u0643\u0627\u0645\u0644 \u0628\u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0627\u062A \u2014 \u0644\u0644\u0645\u0633\u062A\u0644\u0645 \u0641\u0642\u0637' },
                    { name: '`/rename-ticket`', value: '\u062A\u063A\u064A\u064A\u0631 \u0627\u0633\u0645 \u0642\u0646\u0627\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u2014 \u0644\u0644\u0645\u0633\u062A\u0644\u0645 \u0641\u0642\u0637' },
                    { name: '`/add-user`', value: '\u0625\u0636\u0627\u0641\u0629 \u0634\u062E\u0635 \u0625\u0644\u0649 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0644\u064A\u0634\u0627\u0647\u062F\u0647\u0627' },
                    { name: '`/remove-user`', value: '\u0625\u0632\u0627\u0644\u0629 \u0634\u062E\u0635 \u062A\u0645\u062A \u0625\u0636\u0627\u0641\u062A\u0647 \u0645\u0646 \u0627\u0644\u062A\u0630\u0643\u0631\u0629' }
                )
                .setColor(0x5865F2)
                .setFooter({ text: '\u0644\u0627 \u062A\u0646\u0633\u0649 \u062A\u0633\u062A\u0644\u0645 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0623\u0648\u0644\u0627\u064B \u0642\u0628\u0644 \u0623\u064A \u0625\u062C\u0631\u0627\u0621' })
                .setTimestamp();

            await interaction.reply({ embeds: [staffEmbed], flags: 64 });
            return;
        }

        return;
    }

    // ─── StringSelectMenu (ticket creation) ───────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket-menu') {
        try {
            await interaction.deferReply({ flags: 64 });
        } catch {
            return;
        }

        try {

        const cfg = loadGuildConfig(guildId);
        const ticketNumber = incrementGuildTicket(guildId);
        const channelName = '\uD83C\uDFAB-ticket-' + ticketNumber;
        const guild = interaction.guild;
        const member = interaction.member;

        const selectedValue = interaction.values[0];

        const categoryLabels = {
            'tech-support': '\u062F\u0639\u0645 \u0641\u0646\u064A',
            'events': '\u0642\u0633\u0645 \u0627\u0644\u0641\u0639\u0627\u0644\u064A\u0627\u062A',
            'games': '\u0642\u0633\u0645 \u0627\u0644\u0623\u0644\u0639\u0627\u0628',
            'vip-support': '\u062F\u0639\u0645 \u0639\u0644\u064A\u0627',
            'subscriptions': '\u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643\u0627\u062A \u0648\u0627\u0644\u0627\u0639\u0644\u0627\u0646'
        };

        const categoryRoleId = cfg.categoryRoles && cfg.categoryRoles[selectedValue];
        const fallbackRoleId = cfg.staffRoleId;
        const activeRoleId = categoryRoleId || fallbackRoleId;

        const permissionOverwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
                id: member.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory
                ]
            }
        ];

        if (activeRoleId) {
            permissionOverwrites.push({
                id: activeRoleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory
                ]
            });
        }

        const adminRoles = guild.roles.cache.filter(
            role => role.permissions.has(PermissionFlagsBits.Administrator) && role.id !== activeRoleId
        );
        adminRoles.forEach(role => {
            permissionOverwrites.push({
                id: role.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages
                ]
            });
        });

        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle('\uD83C\uDFAB \u062A\u0630\u0643\u0631\u0629 #' + ticketNumber)
            .addFields(
                { name: '\u0627\u0644\u0641\u0626\u0629', value: categoryLabels[selectedValue], inline: true },
                { name: '\u0635\u0627\u062D\u0628 \u0627\u0644\u062A\u0630\u0643\u0631\u0629', value: '<@' + member.id + '>', inline: true },
                { name: '\u0627\u0644\u062D\u0627\u0644\u0629', value: '\u0645\u0641\u062A\u0648\u062D\u0629 \u2014 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0638\u0641', inline: true }
            )
            .setDescription(
                '\u0645\u0631\u062D\u0628\u0627\u064B! \u064A\u0631\u062C\u0649 \u0648\u0635\u0641 \u0645\u0634\u0643\u0644\u062A\u0643 \u0648\u0633\u064A\u062A\u0648\u0644\u0649 \u0623\u062D\u062F \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0627\u0644\u0631\u062F \u0639\u0644\u064A\u0643 \u0642\u0631\u064A\u0628\u0627\u064B.'
            )
            .setColor(0x57F287)
            .setTimestamp();

        const claimButton = new ButtonBuilder()
            .setCustomId('claim-ticket:' + ticketNumber + ':' + member.id)
            .setLabel('\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u062A\u0630\u0643\u0631\u0629')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('\uD83D\uDC64');

        const closeButton = new ButtonBuilder()
            .setCustomId('close-ticket:' + ticketNumber + ':' + member.id)
            .setLabel('\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062A\u0630\u0643\u0631\u0629')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('\uD83D\uDD12');

        const buttonRow = new ActionRowBuilder().addComponents(claimButton, closeButton);

        const pings = ['<@' + member.id + '>'];
        if (activeRoleId) pings.push('<@&' + activeRoleId + '>');

        await channel.send({
            content: pings.join(' '),
            embeds: [ticketEmbed],
            components: [buttonRow]
        });

        const openCfg = loadGuildConfig(guildId);
        if (!openCfg.channelOwners) openCfg.channelOwners = {};
        openCfg.channelOwners[channel.id] = member.id;
        if (!openCfg.channelCategories) openCfg.channelCategories = {};
        openCfg.channelCategories[channel.id] = selectedValue;
        saveGuildConfig(guildId, openCfg);

        await interaction.editReply({
            content: '\u062A\u0645 \u0641\u062A\u062D \u062A\u0630\u0643\u0631\u062A\u0643: <#' + channel.id + '>'
        });

        } catch (err) {
            console.error('[ticket-create error]', err);
            try {
                await interaction.editReply({ content: '\u274C \u062E\u0637\u0623: `' + (err && err.message ? err.message : String(err)) + '`' });
            } catch {}
        }

        return;
    }

    // ─── setup-category: step 1 — choose category ─────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'setup-category-select') {
        const selectedCat = interaction.values[0];

        const categoryLabels = {
            'tech-support': '\u062F\u0639\u0645 \u0641\u0646\u064A',
            'events': '\u0642\u0633\u0645 \u0627\u0644\u0641\u0639\u0627\u0644\u064A\u0627\u062A',
            'games': '\u0642\u0633\u0645 \u0627\u0644\u0623\u0644\u0639\u0627\u0628',
            'vip-support': '\u062F\u0639\u0645 \u0639\u0644\u064A\u0627',
            'subscriptions': '\u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643\u0627\u062A \u0648\u0627\u0644\u0627\u0639\u0644\u0627\u0646'
        };

        const roleEmbed = new EmbedBuilder()
            .setTitle('\u2699\uFE0F \u062A\u062E\u0635\u064A\u0635 \u0631\u062A\u0628\u0629')
            .setDescription('\u0627\u062E\u062A\u0631\u062A: **' + categoryLabels[selectedCat] + '**\n\n\u0627\u0644\u062D\u064A\u0646 \u0627\u062E\u062A\u0631 \u0627\u0644\u0631\u062A\u0628\u0629 \u0627\u0644\u0645\u062E\u0635\u0635\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645:')
            .setColor(0x5865F2);

        const roleMenu = new RoleSelectMenuBuilder()
            .setCustomId('setup-category-role:' + selectedCat)
            .setPlaceholder('\u0627\u062E\u062A\u0631 \u0627\u0644\u0631\u062A\u0628\u0629...');

        await interaction.update({
            embeds: [roleEmbed],
            components: [new ActionRowBuilder().addComponents(roleMenu)]
        });
        return;
    }

    // ─── setup-category: step 2 — choose role ─────────────────────────────────
    if (interaction.isRoleSelectMenu() && interaction.customId.startsWith('setup-category-role:')) {
        const selectedCat = interaction.customId.split(':')[1];
        const selectedRole = interaction.roles.first();

        const categoryLabels = {
            'tech-support': '\u062F\u0639\u0645 \u0641\u0646\u064A',
            'events': '\u0642\u0633\u0645 \u0627\u0644\u0641\u0639\u0627\u0644\u064A\u0627\u062A',
            'games': '\u0642\u0633\u0645 \u0627\u0644\u0623\u0644\u0639\u0627\u0628',
            'vip-support': '\u062F\u0639\u0645 \u0639\u0644\u064A\u0627',
            'subscriptions': '\u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643\u0627\u062A \u0648\u0627\u0644\u0627\u0639\u0644\u0627\u0646'
        };

        const cfg = loadGuildConfig(guildId);
        if (!cfg.categoryRoles) cfg.categoryRoles = {};
        cfg.categoryRoles[selectedCat] = selectedRole.id;
        saveGuildConfig(guildId, cfg);

        const doneEmbed = new EmbedBuilder()
            .setTitle('\u2705 \u062A\u0645 \u0627\u0644\u062A\u062E\u0635\u064A\u0635')
            .setDescription(
                '\u0642\u0633\u0645 **' + categoryLabels[selectedCat] + '** \u2192 <@&' + selectedRole.id + '>\n\n' +
                '\u0633\u064A\u062A\u0645 \u0645\u0646\u0634\u0646 \u0647\u0630\u0647 \u0627\u0644\u0631\u062A\u0628\u0629 \u0641\u0642\u0637 \u0639\u0646\u062F \u0641\u062A\u062D \u062A\u0630\u0627\u0643\u0631 \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645\u060C \u0648\u0644\u0627 \u064A\u0634\u0648\u0641\u0647\u0627 \u063A\u064A\u0631\u0647\u0645.'
            )
            .setColor(0x57F287)
            .setTimestamp();

        await interaction.update({ embeds: [doneEmbed], components: [] });
        return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('claim-ticket:')) {
        const parts = interaction.customId.split(':');
        const ticketNumber = parts[1];
        const ownerId = parts[2];
        const claimant = interaction.member;
        const channel = interaction.channel;
        const cfg = loadGuildConfig(guildId);

        const isAdmin = claimant.permissions.has(PermissionFlagsBits.Administrator);
        const channelCat = cfg.channelCategories && cfg.channelCategories[channel.id];
        const catRoleId = channelCat && cfg.categoryRoles && cfg.categoryRoles[channelCat];
        const hasStaffRole = (cfg.staffRoleId && claimant.roles.cache.has(cfg.staffRoleId)) ||
                             (catRoleId && claimant.roles.cache.has(catRoleId));

        if (!isAdmin && !hasStaffRole) {
            try {
                await interaction.reply({ content: '\u0647\u0630\u0627 \u0627\u0644\u062E\u064A\u0627\u0631 \u0644\u0645\u0648\u0638\u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u0641\u0642\u0637.', flags: 64 });
            } catch {}
            return;
        }

        try {
            const closeOnly = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close-ticket:' + ticketNumber + ':' + ownerId + ':' + claimant.id)
                    .setLabel('\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062A\u0630\u0643\u0631\u0629')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('\uD83D\uDD12')
            );

            await interaction.message.edit({ components: [closeOnly] });

            const claimCfg = loadGuildConfig(guildId);
            if (!claimCfg.claims) claimCfg.claims = {};
            claimCfg.claims[claimant.id] = (claimCfg.claims[claimant.id] || 0) + 1;
            if (!claimCfg.channelClaimants) claimCfg.channelClaimants = {};
            claimCfg.channelClaimants[channel.id] = claimant.id;
            saveGuildConfig(guildId, claimCfg);

            const claimOverwrites = [
                { id: channel.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                {
                    id: ownerId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                },
                {
                    id: claimant.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages
                    ]
                }
            ];

            const claimChannelCat = claimCfg.channelCategories && claimCfg.channelCategories[channel.id];
            const claimCatRoleId = claimChannelCat && claimCfg.categoryRoles && claimCfg.categoryRoles[claimChannelCat];
            const activeStaffRoleId = claimCatRoleId || claimCfg.staffRoleId;
            if (activeStaffRoleId && activeStaffRoleId !== claimant.id) {
                claimOverwrites.push({
                    id: activeStaffRoleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                    deny: [PermissionFlagsBits.SendMessages]
                });
            }

            channel.guild.roles.cache
                .filter(role => role.permissions.has(PermissionFlagsBits.Administrator))
                .forEach(role => {
                    claimOverwrites.push({
                        id: role.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageMessages
                        ]
                    });
                });

            await channel.permissionOverwrites.set(claimOverwrites);

            const claimEmbed = new EmbedBuilder()
                .setDescription(
                    '\uD83D\uDC64 \u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0628\u0648\u0627\u0633\u0637\u0629 <@' + claimant.id + '>.\n' +
                    '\u0633\u064A\u062A\u0648\u0644\u0649 \u0647\u0648 \u0627\u0644\u0631\u062F \u0639\u0644\u0649 \u062A\u0630\u0643\u0631\u062A\u0643.'
                )
                .setColor(0x5865F2)
                .setTimestamp();

            await interaction.reply({ embeds: [claimEmbed] });
        } catch (err) {
            console.error('Claim error:', err.message);
        }

        return;
    }

    // ─── Close button ─────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('close-ticket:')) {
        const parts = interaction.customId.split(':');
        const ticketNumber = parts[1];
        const ownerId = parts[2];
        const claimantId = parts[3] || null;
        const closer = interaction.member;
        const channel = interaction.channel;
        const cfg = loadGuildConfig(guildId);

        const isAdmin = closer.permissions.has(PermissionFlagsBits.Administrator);
        const closeChannelCat = cfg.channelCategories && cfg.channelCategories[channel.id];
        const closeCatRoleId = closeChannelCat && cfg.categoryRoles && cfg.categoryRoles[closeChannelCat];
        const hasStaffRole = (cfg.staffRoleId && closer.roles.cache.has(cfg.staffRoleId)) ||
                             (closeCatRoleId && closer.roles.cache.has(closeCatRoleId));

        if (!isAdmin && !hasStaffRole) {
            try {
                await interaction.reply({ content: '\u0641\u0642\u0637 \u0645\u0648\u0638\u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u064A\u0645\u0643\u0646\u0647\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062A\u0630\u0643\u0631\u0629.', flags: 64 });
            } catch {}
            return;
        }

        if (claimantId && !isAdmin && closer.id !== claimantId) {
            try {
                await interaction.reply({
                    content: '\u274C \u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0625\u063A\u0644\u0627\u0642 \u0647\u0630\u0647 \u0627\u0644\u062A\u0630\u0643\u0631\u0629. \u0641\u0642\u0637 \u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0630\u064A \u0627\u0633\u062A\u0644\u0645\u0647\u0627 (<@' + claimantId + '>) \u0623\u0648 \u0627\u0644\u0645\u0634\u0631\u0641 \u064A\u0645\u0643\u0646\u0647 \u0630\u0644\u0643.',
                    flags: 64
                });
            } catch {}
            return;
        }

        try {
            await interaction.deferReply();
        } catch {
            return;
        }

        const ownerTag2 = ownerId ? (await interaction.guild.members.fetch(ownerId).catch(() => null))?.user?.tag : null;
        const claimantTag2 = claimantId ? (await interaction.guild.members.fetch(claimantId).catch(() => null))?.user?.tag : null;
        const transcript = await buildTranscript(channel, ticketNumber);

        if (cfg.logsChannelId) {
            const logsChannel = channel.guild.channels.cache.get(cfg.logsChannelId);
            if (logsChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('\uD83D\uDCCB \u0633\u062C\u0644 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 #' + ticketNumber)
                    .addFields(
                        { name: '\uD83D\uDC64 \u0635\u0627\u062D\u0628 \u0627\u0644\u062A\u0630\u0643\u0631\u0629', value: ownerId ? '<@' + ownerId + '>' : '\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641', inline: true },
                        { name: '\uD83D\uDD12 \u0623\u063A\u0644\u0642\u0647\u0627', value: '<@' + closer.id + '>', inline: true },
                        { name: '\uD83D\uDCC1 \u0627\u0644\u0642\u0646\u0627\u0629', value: channel.name, inline: true }
                    )
                    .setColor(0xED4245)
                    .setTimestamp();

                await logsChannel.send({ embeds: [logEmbed], files: [transcript] });
            }
        }

        const closeCfg = loadGuildConfig(guildId);
        closeCfg.closedCount = (closeCfg.closedCount || 0) + 1;
        if (closeCfg.channelClaimants) delete closeCfg.channelClaimants[channel.id];
        if (closeCfg.channelOwners) delete closeCfg.channelOwners[channel.id];
        saveGuildConfig(guildId, closeCfg);

        const closeEmbed = new EmbedBuilder()
            .setTitle('\uD83D\uDD12 \u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062A\u0630\u0643\u0631\u0629')
            .setDescription('\u0633\u064A\u062A\u0645 \u062D\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u0642\u0646\u0627\u0629 \u062E\u0644\u0627\u0644 5 \u062B\u0648\u0627\u0646.')
            .setColor(0xED4245)
            .setTimestamp();

        await interaction.editReply({ embeds: [closeEmbed] });

        setTimeout(async () => {
            await channel.delete('Closed by ' + closer.user.tag).catch(() => null);
        }, 5000);

        return;
    }
});

client.login(TOKEN);
