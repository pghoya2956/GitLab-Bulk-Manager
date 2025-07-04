# Getting Started

## Prerequisites

- Node.js 16+ and npm
- GitLab instance with API access
- GitLab Personal Access Token with appropriate scopes

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd gitlab-bulk-manager/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set:
   ```
   VITE_API_URL=http://localhost:5000
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

## Backend Setup

The frontend requires the backend API server to be running:

1. **Configure GitLab credentials**
   ```bash
   cd ../Scripts
   cp config/gitlab.env.example config/gitlab.env
   ```
   
   Edit `config/gitlab.env`:
   ```bash
   GITLAB_URL="https://gitlab.example.com"
   GITLAB_TOKEN="your-personal-access-token"
   ```

2. **Start the API server**
   ```bash
   cd ../backend
   npm install
   npm start
   ```

## First Login

1. Navigate to `http://localhost:3000`
2. You'll be redirected to the login page
3. Enter your GitLab credentials:
   - GitLab URL: Your GitLab instance URL
   - Access Token: Your personal access token

The credentials are stored in localStorage and used for all API requests.

## Configuration Files

### Frontend Configuration

- `.env` - Environment variables for the frontend
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript configuration

### Backend Configuration

- `Scripts/config/gitlab.env` - GitLab API credentials
- `Scripts/config/*.txt` - Input files for bulk operations

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/         # Page components
│   ├── services/      # API service layer
│   ├── store/         # Redux store and slices
│   ├── hooks/         # Custom React hooks
│   └── utils/         # Utility functions
├── public/            # Static assets
└── docs/             # Documentation