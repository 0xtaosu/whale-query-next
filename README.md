# Whale Query - Token Holder Analysis Tool

A Next.js application for analyzing token holder relationships and visualizing whale movements.

## Features

- Token holder analysis
- Relationship graph visualization
- SNS domain integration
- Whale movement tracking
- Interactive data exploration

## Prerequisites

Before running this project, you need:

- Node.js 18+ installed
- Yarn or npm package manager
- Environment variables configured (see below)

## Environment Setup

Create a `.env` file in the root directory with:

```env
DUNE_API_KEY=your_dune_api_key
SOLSCAN_API_KEY=your_solscan_api_key
SOLSCAN_API_URL=https://api.solscan.io
SOL_TOKEN_ADDRESS=your_sol_token_address
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/whale-query-next.git
cd whale-query-next
```

2. Install dependencies:
```bash
yarn install
# or
npm install
```

3. Run the development server:
```bash
yarn dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Usage

1. Enter a token address in the search field
2. Click "Analyze" to generate the holder relationship graph
3. Interact with the graph to explore relationships
4. View holder details and SNS information

## API Endpoints

- `POST /api/analyze`: Analyze token holder relationships
  - Request body: `{ tokenAddress: string }`
  - Returns holder graph data

## Technical Stack

- Next.js 14
- TypeScript
- D3.js for visualizations
- Dune Analytics API
- Solscan API
- Tailwind CSS

## Development

```bash
# Run tests
yarn test

# Build for production
yarn build

# Start production server
yarn start
```

## Deployment

The application is deployed on Vercel. For deployment:

1. Push to main branch
2. Vercel will automatically deploy
3. Configure environment variables in Vercel dashboard

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[MIT License](LICENSE)

## Acknowledgments

- [Next.js](https://nextjs.org)
- [Dune Analytics](https://dune.com)
- [Solscan](https://solscan.io)
- [D3.js](https://d3js.org)