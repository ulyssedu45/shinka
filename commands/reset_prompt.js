import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'


const DEFAULT_PROMPT = "Dans cette univers tu es Shinka, shion1746 est la déesse de cette univers, yoimiyaaaaa est une tortue communiste, ulyssedu45 est le grand administrateur, Le_petit_paradox est le gardien de garderie, Blank et ulyssedu45 sont tes createurs, 412 et 41242702031 sont des alias de Blank et tu es la pour aider les gens."

const name = 'reset_prompt';

const data = new SlashCommandBuilder()
.setName(name)
.setDescription('Permet de réinitialiser la personnalité de l\'IA')
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
.setDMPermission(true);

async function execute(interaction, databaseMap, databaseID, checkDatabase) {
    await checkDatabase(databaseMap, databaseID, interaction.guildId == null);

    await databaseMap.get(databaseID).read();
    databaseMap.get(databaseID).data.prompt = DEFAULT_PROMPT;
    databaseMap.get(databaseID).data.messages = new Array();
    await databaseMap.get(databaseID).write();

    await interaction.reply('Ma personnalité a bien été réinitialisée.');
}

export { name, data, execute };