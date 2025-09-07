# Supabase Bootstrapper CLI Tool

A comprehensive CLI tool for bootstrapping, managing, and deploying Supabase projects with advanced migration tracking and database management capabilities.

## 🚀 Features

### Core Features
- **Project Initialization**: Bootstrap complete Supabase projects from official Docker templates
- **Environment Generation**: Automatically generate secure environment configurations with JWT tokens
- **Advanced Migration System**: Track and apply database migrations with proper versioning
- **Database Operations**: Deploy, backup, and manage PostgreSQL databases
- **Local Development**: Start/stop local Supabase instances with Docker Compose

### Enhanced Features
- ✅ **Migration Tracking**: Proper migration versioning with `schema_migrations` table
- ✅ **Individual Migration Files**: Create and apply migrations incrementally
- ✅ **Migration Status**: View applied vs pending migrations
- ✅ **Database Connection Testing**: Validate database connectivity
- ✅ **Schema Dumping**: Export database schema for backups or baselines
- ✅ **Error Handling**: Comprehensive error reporting and validation
- ✅ **Security**: Proper password handling and input validation

## 📦 Installation

### Prerequisites
- [Bun](https://bun.sh/) runtime
- [Docker](https://www.docker.com/) and Docker Compose
- Git

### Setup
```bash
# Clone and install dependencies
git clone https://github.com/suliluz/supabase-migration-tool.git
cd supabase-migration-tool
bun install
```

## 🔨 Building with Bun

You can build a standalone executable that doesn't require the source code or `bun run` to execute:

### Build Standalone Executable
```bash
# Build a cross-platform standalone executable
bun build index.ts --compile --outfile supabase-bootstrapper

# For specific platforms:
# Linux
bun build index.ts --compile --target=bun-linux-x64 --outfile supabase-bootstrapper-linux

# Windows
bun build index.ts --compile --target=bun-windows-x64 --outfile supabase-bootstrapper.exe

# macOS
bun build index.ts --compile --target=bun-darwin-x64 --outfile supabase-bootstrapper-macos

# Make it executable (macOS/Linux)
chmod +x supabase-bootstrapper

# Test the built executable
./supabase-bootstrapper --help
```

The compiled executable includes the Bun runtime and all dependencies, making it completely self-contained.

## 🚀 Quick Start

### 1. Initialize Project Structure
```bash
# Using source code
bun run index.ts init

# Using compiled executable
./supabase-bootstrapper init
```

### 2. Create Configuration Template
```bash
bun run index.ts create
# Edit the generated input.json file with your configuration
```

### 3. Generate Environment File
```bash
bun run index.ts generate -i input.json
```

### 4. Start Local Development
```bash
bun run index.ts start
# Access dashboard at http://localhost:3000
```

## 📋 Commands Reference

### Project Setup
| Command | Description |
|---------|-------------|
| `init` | Initialize Supabase project structure |
| `create` | Create input.json template file |
| `generate -i <file>` | Generate .env from input file |

### Database Management
| Command | Options | Description |
|---------|---------|-------------|
| `deploy` | `-h, -p, -u, -d` | Deploy combined SQL schema |
| `migrate` | `-h, -p, -u, -d, -t` | Apply pending migrations |
| `create-migration -n <name>` | | Create new migration file |
| `status` | `-h, -p, -u, -d` | Show migration status |
| `dump-schema` | `-h, -p, -u, -d` | Export database schema |
| `test-connection` | `-h, -p, -u, -d` | Test database connectivity |
| `clean` | `-h, -p, -u, -d, --force, --backup` | Clean database |

### Local Development
| Command | Options | Description |
|---------|---------|-------------|
| `start` | `-d, --detach` | Start Supabase locally |
| `stop` | | Stop local Supabase |

### Database Connection Options
- `-h, --host <host>` - Database host (default: localhost)
- `-p, --port <port>` - Database port (default: 5432)
- `-u, --user <user>` - Database user (default: postgres)
- `-d, --database <database>` - Database name (default: postgres)

## 🔐 Environment Variables

You can use environment variables instead of command-line options:

```bash
# Set connection variables
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_USER=postgres
export POSTGRES_DB=mydatabase
export POSTGRES_PASSWORD=mypassword

# Run commands without options
bun run index.ts deploy
bun run index.ts migrate
```

## 📁 Project Structure

```
supabase-project/
├── .env                    # Generated environment file
├── docker-compose.yml      # Docker Compose configuration
├── postgres/              # Schema files (for deploy command)
│   ├── base.sql
│   ├── constraints.sql
│   ├── data.sql
│   ├── enums.sql
│   ├── functions.sql
│   ├── genesis.sql
│   ├── pre.sql
│   ├── triggers.sql
│   └── views.sql
└── migrations/            # Migration files (for migrate command)
    ├── 20240101120000_initial_schema.sql
    ├── 20240102130000_add_users_table.sql
    └── backup_20240103140000/
```

## 🔄 Migration Workflow

### 1. Schema Deployment (Initial Setup)
Use the `deploy` command for initial database setup or full rebuilds:
```bash
# Edit files in supabase-project/postgres/
bun run index.ts deploy
```

### 2. Incremental Migrations
Use the migration system for ongoing changes:
```bash
# Create a new migration
bun run index.ts create-migration -n "add_user_profiles_table"

# Edit the generated migration file
# Apply migrations
bun run index.ts migrate

# Check status
bun run index.ts status
```

### 3. Backup Before Changes
```bash
# Create backup before major changes
bun run index.ts dump-schema

# Clean database if needed (with backup)
bun run index.ts clean --backup
```

## 🎯 Use Cases

### Development Workflow
1. **Initial Setup**: `init` → `create` → `generate` → `start`
2. **Schema Changes**: `create-migration` → edit migration → `migrate`
3. **Testing**: `test-connection` → `status` → `dump-schema`

### Production Deployment
1. **Prepare**: `deploy` for initial schema
2. **Migrate**: `migrate` for incremental updates
3. **Backup**: `dump-schema` before major changes

### Database Management
1. **Reset**: `clean --backup` → `deploy` → `migrate`
2. **Status**: `status` → `test-connection`
3. **Recovery**: Use backup files from `dump-schema`

## ⚠️ Disclaimers and Important Notes

### Production Use Warning
**⚠️ IMPORTANT: The developer is not responsible for any issues that may arise in production environments. It is the user's responsibility to:**

- **Test thoroughly** in development/staging environments before production use
- **Create backups** before running any database operations
- **Validate** all migrations and schema changes
- **Monitor** database performance and integrity after deployments
- **Have rollback plans** in case of issues

### Backup Recommendations
- Always run `dump-schema` before major database operations
- Test restore procedures with backups regularly
- Keep multiple backup copies for critical data
- Use the `--backup` flag with `clean` command when resetting databases

### Security Considerations
- Keep `POSTGRES_PASSWORD` secure and never commit it to version control
- Use strong passwords for database connections
- Limit database user permissions in production
- Review generated JWT secrets and rotate them regularly

### Best Practices
- Test migrations on a copy of production data
- Use descriptive names for migrations
- Keep migrations reversible when possible
- Document complex schema changes
- Monitor migration execution times

## 🐛 Troubleshooting

### Common Issues
1. **Connection Failed**: Check database credentials and network connectivity
2. **Migration Errors**: Review SQL syntax and database permissions
3. **Docker Issues**: Ensure Docker is running and ports are available
4. **Permission Denied**: Check file permissions and Docker socket access

### Getting Help
- Check command output for detailed error messages
- Use `test-connection` to verify database connectivity
- Review migration status with `status` command
- Examine generated files in `supabase-project/` directory

## 📞 Feedback and Support

**Feedback is welcome!** Please report issues, suggestions, or improvements through:
- GitHub Issues
- Pull Requests
- Feature Requests

Your feedback helps improve this tool for the community.

---

**Note**: This tool is provided as-is. Users are responsible for ensuring proper testing and validation in their specific environments.
