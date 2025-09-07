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
bun install
```

### 📦 Building Standalone Executable

You can build a standalone executable that doesn't require the source code or `bun run` to execute:

#### Build with Bun
```bash
# Build a standalone executable
bun build index.ts --compile --outfile supabase-bootstrapper

# Make it executable (macOS/Linux)
chmod +x supabase-bootstrapper

# Test the built executable
./supabase-bootstrapper --help
```

#### Cross-Platform Builds
```bash
# Build for different targets
bun build index.ts --compile --target=bun-linux-x64 --outfile supabase-bootstrapper-linux
bun build index.ts --compile --target=bun-darwin-x64 --outfile supabase-bootstrapper-macos
bun build index.ts --compile --target=bun-windows-x64 --outfile supabase-bootstrapper.exe
```

#### Global Installation
```bash
# Build and install globally
bun build index.ts --compile --outfile supabase-bootstrapper
sudo mv supabase-bootstrapper /usr/local/bin/

# Now use anywhere
supabase-bootstrapper init
supabase-bootstrapper status
```

**Benefits of standalone executable:**
- ✅ No need to have the source code locally
- ✅ No need to run with `bun run index.ts`
- ✅ Easy distribution to team members
- ✅ Works on systems without Bun installed (runtime is bundled)

## 🛠 Command Reference

### Project Setup Commands

#### 1. Initialize Project Structure
```bash
bun run index.ts init
```
Downloads the latest Supabase Docker setup and creates the project structure with organized SQL folders.

#### 2. Create Configuration Template
```bash
bun run index.ts create
```
Generates an `input.json` template file for project configuration.

#### 3. Generate Environment
```bash
bun run index.ts generate -i input.json
```
Creates a `.env` file with secure JWT tokens and database credentials.

### Schema Deployment (postgres/ folder)

#### Deploy Full Schema
```bash
# Deploy combined SQL schema (for initial setup or full rebuilds)
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=postgres POSTGRES_DB=postgres POSTGRES_PASSWORD=password bun run index.ts deploy

# Using command line options
bun run index.ts deploy -h localhost -p 5432 -u postgres -d postgres
```
**Use Case**: Initial database setup, complete schema rebuilds, or when working with the organized SQL files in `postgres/` folder.

### Migration System (migrations/ folder)

#### Create New Migration
```bash
bun run index.ts create-migration -n "add_user_profiles"
```
Creates a timestamped migration file: `20250908120000_add_user_profiles.sql`

#### View Migration Status
```bash
# Using environment variables (recommended)
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=postgres POSTGRES_DB=postgres POSTGRES_PASSWORD=password bun run index.ts status

# Using command line options
bun run index.ts status -h localhost -p 5432 -u postgres -d postgres
```

#### Apply Migrations
```bash
# Apply all pending migrations
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=postgres POSTGRES_DB=postgres POSTGRES_PASSWORD=password bun run index.ts migrate

# Apply up to specific migration
bun run index.ts migrate -t "20250908120000_add_user_profiles"
```
**Use Case**: Incremental database updates with proper tracking and rollback safety.

### Database Operations

#### Test Database Connection
```bash
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=postgres POSTGRES_DB=postgres POSTGRES_PASSWORD=password bun run index.ts test-connection
```

#### Export Database Schema
```bash
# Create timestamped schema dump
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=postgres POSTGRES_DB=postgres POSTGRES_PASSWORD=password bun run index.ts dump-schema
```
**Use Case**: Creating baseline snapshots, backups, or capturing existing database state.

### Local Development

#### Start Supabase Locally
```bash
# Start in foreground (logs visible)
bun run index.ts start

# Start in background (detached mode)
bun run index.ts start -d
```

#### Stop Supabase
```bash
bun run index.ts stop
```

## 📋 Complete Workflow Guide

### 🆕 New Project Setup
```bash
# 1. Initialize project structure
bun run index.ts init

# 2. Create configuration template
bun run index.ts create

# 3. Edit input.json with your project details
# 4. Generate environment file
bun run index.ts generate -i input.json

# 5. Start local Supabase
bun run index.ts start -d

# 6. Deploy initial schema (if you have SQL files in postgres/ folder)
bun run index.ts deploy

# 7. Access dashboard at http://localhost:3000
```

### 🔄 Development Workflow

#### Schema-First Development (postgres/ folder)
```bash
# 1. Edit SQL files in postgres/ folder (base.sql, functions.sql, etc.)
# 2. Deploy changes
bun run index.ts deploy

# 3. Test your changes
# 4. When satisfied, create migration for production
bun run index.ts create-migration -n "implement_new_feature"
# 5. Copy relevant SQL from postgres/ files to migration
# 6. Apply migration to track the change
bun run index.ts migrate
```

#### Migration-First Development (migrations/ folder)
```bash
# 1. Create new migration
bun run index.ts create-migration -n "add_payment_system"

# 2. Edit the migration file with your SQL
# 3. Check current status
bun run index.ts status

# 4. Apply migration
bun run index.ts migrate

# 5. Verify application
bun run index.ts status
```

### 🚀 Production Deployment
```bash
# 1. Ensure all migrations are created and tested locally
bun run index.ts status

# 2. Generate production environment
bun run index.ts generate -i production-input.json

# 3. Deploy to production database
POSTGRES_HOST=prod-db.company.com \
POSTGRES_PORT=5432 \
POSTGRES_USER=app_user \
POSTGRES_DB=production \
POSTGRES_PASSWORD=$PROD_PASSWORD \
bun run index.ts migrate

# 4. Verify deployment
bun run index.ts status
```

### 🔄 Schema Synchronization
```bash
# If you need to sync an existing database to your project:

# 1. Export current database schema
bun run index.ts dump-schema

# 2. Review the exported files in migrations/backup_[timestamp]/
# 3. Create baseline migration if needed
bun run index.ts create-migration -n "baseline_schema"

# 4. Copy relevant SQL from backup to migration
# 5. Apply and track
bun run index.ts migrate
```

## 📁 Project Structure

```
your-project/
├── input.json                     # Configuration template
├── supabase-project/
│   ├── .env                      # Generated environment file
│   ├── docker-compose.yml       # Supabase services
│   ├── postgres/                 # Organized SQL schema files
│   │   ├── base.sql             # Basic tables and types
│   │   ├── constraints.sql      # Foreign keys and constraints
│   │   ├── data.sql             # Seed data
│   │   ├── enums.sql            # Enum definitions
│   │   ├── functions.sql        # Stored procedures
│   │   ├── genesis.sql          # Initial setup
│   │   ├── pre.sql              # Pre-migration setup
│   │   ├── triggers.sql         # Database triggers
│   │   └── views.sql            # Database views
│   └── migrations/              # Version-controlled migrations
│       ├── 20250908120000_add_user_table.sql
│       ├── 20250908130000_add_indexes.sql
│       ├── schema-pre.sql       # For migrate command (optional)
│       ├── schema-post.sql      # For migrate command (optional)
│       ├── data.sql             # For migrate command (optional)
│       └── backup_20250908T123456/  # Schema dumps
│           ├── schema-pre.sql
│           ├── schema-post.sql
│           └── data.sql
```

## 🔧 Configuration

### input.json Template
```json
{
  "siteUrl": "http://localhost:3000",
  "apiUrl": "http://localhost:8000", 
  "organization": "My Organization",
  "project": "My Project",
  "additionalRedirectUrls": ["http://localhost:3000/callback"],
  "email": {
    "from": "noreply@yourapp.com",
    "host": "smtp.gmail.com",
    "port": 587,
    "user": "your-email@gmail.com",
    "pass": "your-app-password",
    "senderName": "My App"
  }
}
```

### Environment Variables
```bash
# Required for database operations
POSTGRES_HOST=localhost        # Database host
POSTGRES_PORT=5432            # Database port
POSTGRES_USER=postgres        # Database user
POSTGRES_DB=postgres          # Database name
POSTGRES_PASSWORD=password    # Database password (always from env for security)
```

## ⚠️ Disclaimers

### Important Considerations

**🗄️ Database Operations**
- This tool performs direct database operations including schema changes, data modifications, and migrations
- Always test migrations in a development environment before applying to production
- Create database backups before running migrations on production systems
- The `deploy` command will overwrite existing database schema - use with caution

**🔐 Security & Credentials**
- Database passwords and sensitive information should be stored in environment variables, not in configuration files
- Generated JWT tokens and API keys are cryptographically secure but should be treated as sensitive data
- The tool requires elevated database privileges to create/modify schemas and tables

**🐳 Docker & Local Development**
- The `start` and `stop` commands control Docker containers - ensure Docker daemon is running
- Local Supabase instances will occupy ports 3000, 8000, 5432, and others
- Stopping containers may result in data loss if not using persistent volumes

**📁 File System Operations**
- The tool creates and modifies files in your project directory
- Always use version control (Git) to track changes made by this tool
- Migration files should not be manually edited after being applied to production

**🌐 Production Deployment**
- This tool is designed for development and CI/CD environments
- For critical production systems, consider additional safeguards and approval processes
- Network connectivity to production databases should be secured and monitored

### Best Practices

✅ **Always backup production databases before migrations**  
✅ **Test all migrations in staging environments first**  
✅ **Use environment variables for sensitive configuration**  
✅ **Review generated migration files before applying**  
✅ **Keep migration files in version control**  
✅ **Monitor database performance after schema changes**

### Liability

This tool is provided "as is" without warranty. The developer is not responsible for any issues, data loss, or outages that may occur in production environments as a result of using this tool. It is solely the user's responsibility to ensure the safety, correctness, and suitability of all operations performed with this tool. Always test thoroughly and maintain proper backups.

### Feedback

Feedback, suggestions, and contributions are welcome! Please open an issue or pull request on GitHub.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built on top of [Supabase](https://supabase.com/) Docker setup
- Uses [Commander.js](https://github.com/tj/commander.js/) for CLI interface
- Powered by [Bun](https://bun.sh/) runtime
