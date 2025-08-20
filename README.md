# 🤖 Custos – The Open-Source Discord Moderation Bot

Custos (Latin for "guardian") is a fast, lightweight, and customizable moderation bot for Discord.
Built with [TypeScript](https://www.typescriptlang.org/) and [Bun](https://bun.sh/), Custos provides powerful tools to help keep your community safe while staying easy to run and
extend.

---

## ✨ Features

- 🔨 **Moderation Tools**
  Warn, mute, kick, and ban members with simple commands.

- 🎭 **Role Management**
  - Auto-assign roles to new joiners.
  - Persistent roles on rejoin.
  - Role switching & self-roles.

- 📜 **Logging**
  Keep track of moderation actions in configurable channels.

- ⚡ **Performance First**
  Runs on [Bun](https://bun.sh/) for speed and efficiency.

- 🛠 **Extensible**
  Modular design – add or disable features as needed.

---

## 🐳 Deployment

Custos ships with Docker support for an easy one-step deploy.

```bash
git clone https://github.com/<your-username>/custos.git
cd custos

# Copy example configuration
cp config.example.json config.json

# Build and start via Docker
docker-compose up -d
```

---

## 🔧 Configuration

All bot settings are stored in [`config.json`](config.example.json).

Example:

```json
{
  "token": "YOUR_DISCORD_BOT_TOKEN",
  "prefix": "!",
  "ownerId": "123456789012345678"
}
```

> ⚠️ Never commit your token to Git.
> Use `.env` or secrets when deploying.

---

## 🧑‍💻 Development Setup

If you want to hack on Custos directly:

```bash
# Install dependencies (requires Bun runtime)
bun install

# Run in dev mode
bun run src/main.ts
```

---

## 📂 Project Structure

```
src/
├── main.ts             # Entry point
├── modules/            # Bot features (roles, warns, etc.)
└── utils/              # Helpers & types
```

Modules are self-contained and can be enabled/disabled in the codebase.

---

## 🤝 Contributing

Contributions are welcome!
Here’s how you can help:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/awesome-thing`)
3. Commit and push your changes
4. Open a Pull Request 🚀

Bug reports, feature ideas, and discussions are also welcome in the Issues tab.

---

## 📜 License

Custos is open source under the [MIT License](LICENSE).

---

### 🛡️ Why Custos?

Because every community deserves a reliable guardian – fast, transparent, and entirely under your control. ✨