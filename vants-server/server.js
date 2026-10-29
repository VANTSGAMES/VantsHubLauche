import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import path from 'path';

const app = express();
app.use(express.json());

// Sirve tu web: poné vants.html en una carpeta "public"
app.use(express.static('public'));

// ===== TU BOT =====
const bot = new Client({ intents: [GatewayIntentBits.Guilds] });
await bot.login(process.env.DISCORD_TOKEN);

bot.once('ready', () => console.log('Bot listo:', bot.user.tag));

const COLORS = { rojo:0xFF0D2E, violeta:0xB44CFF, twitch:0x9146FF, oro:0xF5C044 };

function embed(color, title, desc) {
  return new EmbedBuilder()
    .setColor(color).setTitle(title).setDescription(desc)
    .setFooter({ text:'VANTS GAMES — Donde nace la ventaja' })
    .setTimestamp();
}

// Endpoint que llama tu web
app.post('/api/discord/notify', async (req, res) => {
  try {
    const { type, data } = req.body;
    const canal = await bot.channels.fetch(process.env.CHANNEL_ID);
    let e;

    switch (type) {
      case 'torneo_inscripcion':
        e = embed(COLORS.rojo, '🏆 Nueva inscripción',
          `**${data.team} [${data.tag}]** se inscribió en **${data.tournament}**.`);
        break;
      case 'membresia':
        e = embed(COLORS.violeta, '💎 Nueva membresía',
          `**${data.user}** activó **VANTS ${data.plan.toUpperCase()}**. ¡Bienvenido al circuito!`);
        break;
      case 'live':
        e = embed(COLORS.twitch, '🔴 EN DIRECTO',
          `**${data.user}** está transmitiendo:\n**${data.title}**`);
        break;
      case 'campeon':
        e = embed(COLORS.oro, '👑 Nuevo campeón',
          `**${data.team}** ganó **${data.tournament}**. GG!`);
        break;
    }
    if (e) await canal.send({ embeds: [e] });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

app.listen(3000, () => console.log('VANTS + tu bot en http://localhost:3000'));
