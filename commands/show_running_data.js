import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";

import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

const name = 'show_running_data';

const data = new SlashCommandBuilder()
.setName(name)
.setDescription('Permet de changer la personnalité de l\'IA')
.setDMPermission(true);

async function execute(interaction, randomSeed) {

    var fields = new Array();

    for(const seed of randomSeed){
        fields.push({ name: 'Seed ' + randomSeed.indexOf(seed), value: seed.toString() })
    }

    const embed = new EmbedBuilder()
    .setTitle('Données d\'exécution actuelles')
	.setColor(0x0099FF)
	.addFields(fields)
	.setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

export { name, data, execute };