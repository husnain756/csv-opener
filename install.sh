#!/bin/bash

# CSV Opener App Installation Script
# This script sets up the development environment for the CSV Opener application

set -e

echo "🚀 Setting up CSV Opener App..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) is installed"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    print_success "npm $(npm --version) is installed"
}

# Check if PostgreSQL is installed
check_postgresql() {
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL client (psql) not found. Please install PostgreSQL first."
        print_warning "Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
        print_warning "CentOS/RHEL: sudo yum install postgresql postgresql-server"
        print_warning "macOS: brew install postgresql"
        return 1
    fi
    
    if ! command -v createdb &> /dev/null; then
        print_warning "PostgreSQL utilities not found. Please install postgresql-contrib package."
        return 1
    fi
    
    print_success "PostgreSQL client is installed"
    return 0
}

# Check if Redis is running
check_redis() {
    # First check if we have our local Redis installation
    if [ -f "$HOME/redis-local/bin/redis-server" ]; then
        if $HOME/redis-local/bin/redis-cli ping &> /dev/null; then
            print_success "Local Redis (7.2+) is running"
            return 0
        fi
    fi
    
    # Check system Redis
    if ! command -v redis-cli &> /dev/null; then
        print_warning "Redis CLI not found. Will install Redis 7.2+ from source."
        return 1
    fi
    
    # Check Redis version
    REDIS_VERSION=$(redis-server --version 2>/dev/null | grep -o 'v=[0-9]\+\.[0-9]\+\.[0-9]\+' | cut -d'=' -f2 || echo "unknown")
    if [ "$REDIS_VERSION" != "unknown" ]; then
        MAJOR_VERSION=$(echo $REDIS_VERSION | cut -d'.' -f1)
        MINOR_VERSION=$(echo $REDIS_VERSION | cut -d'.' -f2)
        
        if [ "$MAJOR_VERSION" -lt 6 ] || ([ "$MAJOR_VERSION" -eq 6 ] && [ "$MINOR_VERSION" -lt 2 ]); then
            print_warning "Redis version $REDIS_VERSION is below recommended 6.2.0. Will install Redis 7.2+ from source."
            return 1
        fi
    fi
    
    if ! redis-cli ping &> /dev/null; then
        print_warning "Redis is not running. Will install and start Redis 7.2+ from source."
        return 1
    fi
    
    print_success "Redis $REDIS_VERSION is running"
    return 0
}

# Install Redis from source
install_redis() {
    print_status "Installing Redis 7.2+ from source..."
    
    # Check if build tools are available
    if ! command -v gcc &> /dev/null || ! command -v make &> /dev/null; then
        print_error "Build tools (gcc, make) are required to compile Redis."
        print_error "Please install them first:"
        print_error "  Ubuntu/Debian: sudo apt-get install build-essential"
        print_error "  CentOS/RHEL: sudo yum groupinstall 'Development Tools'"
        print_error "  macOS: xcode-select --install"
        exit 1
    fi
    
    # Create Redis directory
    REDIS_DIR="$HOME/redis-local"
    mkdir -p "$REDIS_DIR"
    
    # Download Redis source
    print_status "Downloading Redis 7.2.4 source code..."
    cd /tmp
    if [ ! -f "redis-7.2.4.tar.gz" ]; then
        wget -q https://download.redis.io/releases/redis-7.2.4.tar.gz
    fi
    
    # Extract and compile
    print_status "Extracting and compiling Redis..."
    tar -xzf redis-7.2.4.tar.gz
    cd redis-7.2.4
    
    # Configure and make
    make PREFIX="$REDIS_DIR" install
    
    # Create Redis configuration
    print_status "Creating Redis configuration..."
    cat > "$REDIS_DIR/redis.conf" << EOF
# Redis configuration for CSV Opener App
port 6380
bind 127.0.0.1
daemonize yes
pidfile $REDIS_DIR/redis.pid
logfile $REDIS_DIR/redis.log
dir $REDIS_DIR/data
save 900 1
save 300 10
save 60 10000
EOF
    
    # Create data directory
    mkdir -p "$REDIS_DIR/data"
    
    # Create startup script
    print_status "Creating Redis startup script..."
    cat > "$REDIS_DIR/start-redis.sh" << EOF
#!/bin/bash
# Start Redis for CSV Opener App
cd "$REDIS_DIR"
./bin/redis-server redis.conf
echo "Redis started on port 6380"
echo "PID: \$(cat redis.pid)"
EOF
    
    chmod +x "$REDIS_DIR/start-redis.sh"
    
    # Create stop script
    cat > "$REDIS_DIR/stop-redis.sh" << EOF
#!/bin/bash
# Stop Redis for CSV Opener App
cd "$REDIS_DIR"
if [ -f redis.pid ]; then
    PID=\$(cat redis.pid)
    if kill -0 \$PID 2>/dev/null; then
        kill \$PID
        echo "Redis stopped"
    else
        echo "Redis was not running"
    fi
    rm -f redis.pid
else
    echo "Redis PID file not found"
fi
EOF
    
    chmod +x "$REDIS_DIR/stop-redis.sh"
    
    # Start Redis
    print_status "Starting Redis..."
    "$REDIS_DIR/start-redis.sh"
    
    # Wait a moment for Redis to start
    sleep 2
    
    # Test connection
    if "$REDIS_DIR/bin/redis-cli" -p 6380 ping &> /dev/null; then
        print_success "Redis 7.2.4 installed and running on port 6380"
        print_status "Redis location: $REDIS_DIR"
        print_status "Start script: $REDIS_DIR/start-redis.sh"
        print_status "Stop script: $REDIS_DIR/stop-redis.sh"
    else
        print_error "Failed to start Redis"
        exit 1
    fi
    
    # Clean up
    cd /tmp
    rm -rf redis-7.2.4 redis-7.2.4.tar.gz 2>/dev/null || true
    
    # Return to original directory
    cd - > /dev/null
}

# Install dependencies
install_dependencies() {
    print_status "Installing root dependencies..."
    npm install
    
    print_status "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    
    print_status "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    
    print_success "All dependencies installed successfully"
}

# Setup PostgreSQL database
setup_database() {
    print_status "Setting up PostgreSQL database..."
    
    # Check if database exists
    if psql -lqt | cut -d \| -f 1 | grep -qw csv_opener; then
        print_success "Database 'csv_opener' already exists"
    else
        print_status "Creating database 'csv_opener'..."
        if createdb csv_opener; then
            print_success "Database 'csv_opener' created successfully"
        else
            print_error "Failed to create database. Please check PostgreSQL is running and you have permissions."
            print_warning "You can create the database manually: createdb csv_opener"
            return 1
        fi
    fi
    
    # Run database setup script
    print_status "Setting up database tables..."
    cd backend
    if npm run setup-db; then
        print_success "Database tables created successfully"
    else
        print_error "Failed to setup database tables"
        print_warning "You can run 'cd backend && npm run setup-db' manually"
        cd ..
        return 1
    fi
    cd ..
    
    return 0
}

# Setup environment files
setup_environment() {
    print_status "Setting up environment files..."
    
    # Backend environment
    if [ ! -f backend/.env ]; then
        cp backend/env.example backend/.env
        
        # Update Redis URL to use local Redis if it exists
        if [ -f "$HOME/redis-local/bin/redis-server" ]; then
            sed -i 's|REDIS_URL=redis://localhost:6379|REDIS_URL=redis://localhost:6380|' backend/.env
            print_success "Created backend/.env with local Redis configuration"
        else
            print_success "Created backend/.env from template"
        fi
        
        print_warning "Please edit backend/.env and add your OpenAI API key"
        print_warning "For development, you can set OPENAI_DUMMY_MODE=true to avoid API costs"
    else
        # Update existing .env file to use local Redis if it exists
        if [ -f "$HOME/redis-local/bin/redis-server" ]; then
            if grep -q "REDIS_URL=redis://localhost:6379" backend/.env; then
                sed -i 's|REDIS_URL=redis://localhost:6379|REDIS_URL=redis://localhost:6380|' backend/.env
                print_success "Updated backend/.env to use local Redis"
            fi
        fi
        print_warning "backend/.env already exists, skipping..."
    fi
    
    # Create necessary directories
    mkdir -p backend/uploads
    mkdir -p backend/outputs
    mkdir -p backend/logs
    
    print_success "Environment setup complete"
}

# Build the application
build_application() {
    print_status "Building application..."
    
    # Build frontend
    cd frontend
    npm run build
    cd ..
    
    # Build backend
    cd backend
    npm run build
    cd ..
    
    print_success "Application built successfully"
}

# Main installation process
main() {
    echo "=========================================="
    echo "  CSV Opener App Installation Script"
    echo "=========================================="
    echo
    
    # Check prerequisites
    print_status "Checking prerequisites..."
    check_node
    check_npm
    check_postgresql
    
    # Check and install Redis if needed
    if ! check_redis; then
        print_status "Installing Redis 7.2+ from source..."
        install_redis
    fi
    
    echo
    
    # Install dependencies
    print_status "Installing dependencies..."
    install_dependencies
    
    echo
    
    # Setup environment
    print_status "Setting up environment..."
    setup_environment
    
    echo
    
    # Setup database
    print_status "Setting up database..."
    if ! setup_database; then
        print_warning "Database setup failed, but continuing with installation..."
        print_warning "You can run database setup manually later"
    fi
    
    echo
    
    # Build application
    print_status "Building application..."
    build_application
    
    echo
    echo "=========================================="
    print_success "Installation completed successfully!"
    echo "=========================================="
    echo
    echo "Next steps:"
    echo "1. Edit backend/.env and add your OpenAI API key"
    echo "2. Ensure PostgreSQL is running and database is set up"
    echo "3. Redis is already running (Redis 7.2+ on port 6380)"
    echo "4. Start the development servers:"
    echo "   npm run dev"
    echo
    echo "The app will be available at:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:3001"
    echo
    echo "Database Management:"
    echo "  Database: csv_opener (PostgreSQL)"
    echo "  Setup tables: cd backend && npm run setup-db"
    echo
    echo "Redis Management:"
    echo "  Start Redis: ~/redis-local/start-redis.sh"
    echo "  Stop Redis:  ~/redis-local/stop-redis.sh"
    echo "  Redis Port:  6380 (instead of default 6379)"
    echo
    echo "For production deployment, see README.md"
}

# Run main function
main "$@"

