import { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";

import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

const name = 'set_prompt';

const data = new SlashCommandBuilder()
.setName(name)
.setDescription('Permet de changer la personnalité de l\'IA')
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
.setDMPermission(true);

async function execute(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('modalChangePrompt')
        .setTitle('Changer ma personnalité');

    const promptDataInput = new TextInputBuilder()
        .setCustomId('prompt_data_input')
        .setLabel("Personnalité")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(promptDataInput);

    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}

export { name, data, execute };