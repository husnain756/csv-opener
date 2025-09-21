#!/bin/bash

# Quick Start Script for CSV Opener App
# This script provides quick commands to get the app running

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to show help
show_help() {
    echo "CSV Opener App - Quick Start Commands"
    echo
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  install     - Install dependencies and setup environment"
    echo "  dev         - Start development servers"
    echo "  build       - Build the application"
    echo "  start       - Start production servers"
    echo "  redis       - Start Redis server (if installed)"
    echo "  redis-stop  - Stop Redis server"
    echo "  clean       - Clean build artifacts and node_modules"
    echo "  help        - Show this help message"
    echo
    echo "Examples:"
    echo "  $0 install  # First time setup"
    echo "  $0 dev      # Start development"
    echo "  $0 build    # Build for production"
}

# Install dependencies
install() {
    print_status "Installing dependencies..."
    npm run install:all
    print_success "Dependencies installed"
}

# Start development servers
dev() {
    print_status "Starting development servers..."
    print_warning "Make sure Redis is running before starting the app"
    npm run dev
}

# Build application
build() {
    print_status "Building application..."
    npm run build
    print_success "Application built successfully"
}

# Start production servers
start() {
    print_status "Starting production servers..."
    npm run start
}

# Start Redis (if available)
redis() {
    # Check for local Redis installation first
    if [ -f "$HOME/redis-local/start-redis.sh" ]; then
        print_status "Starting local Redis (7.2+)..."
        "$HOME/redis-local/start-redis.sh"
        print_success "Local Redis server started on port 6380"
    elif command -v redis-server &> /dev/null; then
        print_status "Starting system Redis server..."
        redis-server --daemonize yes
        print_success "System Redis server started"
    else
        print_warning "Redis server not found. Please run './install.sh' first to install Redis."
    fi
}

# Stop Redis
redis_stop() {
    # Check for local Redis installation first
    if [ -f "$HOME/redis-local/stop-redis.sh" ]; then
        print_status "Stopping local Redis..."
        "$HOME/redis-local/stop-redis.sh"
        print_success "Local Redis server stopped"
    elif command -v redis-cli &> /dev/null; then
        print_status "Stopping system Redis server..."
        redis-cli shutdown
        print_success "System Redis server stopped"
    else
        print_warning "Redis server not found."
    fi
}

# Clean build artifacts
clean() {
    print_status "Cleaning build artifacts..."
    
    # Remove node_modules
    rm -rf node_modules
    rm -rf frontend/node_modules
    rm -rf backend/node_modules
    
    # Remove build artifacts
    rm -rf frontend/.next
    rm -rf frontend/out
    rm -rf backend/dist
    
    # Remove logs
    rm -rf backend/logs/*.log
    
    print_success "Clean completed"
}

# Main script logic
case "${1:-help}" in
    install)
        install
        ;;
    dev)
        dev
        ;;
    build)
        build
        ;;
    start)
        start
        ;;
    redis)
        redis
        ;;
    redis-stop)
        redis_stop
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_warning "Unknown command: $1"
        echo
        show_help
        exit 1
        ;;
esac

