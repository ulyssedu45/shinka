import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

const name = 'reset_history';

const data = new SlashCommandBuilder()
.setName(name)
.setDescription('Permet de réinitialiser l\'historique de l\'IA')
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
.setDMPermission(true);

async function execute(interaction, databaseMap, databaseID, checkDatabase) {
    await checkDatabase(databaseMap, databaseID, interaction.guildId == null);
            
    await databaseMap.get(databaseID).read();
    databaseMap.get(databaseID).data.messages = new Array();
    await databaseMap.get(databaseID).write();

    await interaction.reply('Ma mémoire a bien été réinitialisée.');
}

export { name, data, execute };