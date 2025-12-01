# stock-farmer

Stock Farmer is a work-in-progress game that blends a farming sim with real stock market data. Plant crops that are tied to tickers, watch prices move, then harvest to reap rewards.

## Status

- Active development; visuals, controls, and balancing will continue to shift.
- Market data is simulated (prices drift every second). The roadmap includes swapping in real-time stock information.

## Gameplay loop

- Pick a crop: Unlock higher-value crops as you earn; plant costs and grow times scale with value.
- Pick a stock: Choose a ticker that will drive that crop’s payout; the ticker is stored on the plot.
- Plant on farmland: Farmland tiles are required (first four are free, later ones cost). Use the size selector for 1x1, 2x2, etc.
- Let it grow: Each crop has a timer. While growing, its estimated payout updates with the linked stock’s price movement.
- Harvest with the hoe: When ready, the stock price locks for that plot. Payout = base crop value × (1 + percent change from the price when planted). Negative moves can reduce the return to zero.

## Controls and notes

- Use the nav drawer to switch crops, tickers, and brush sizes; toggle the hoe to harvest or clear.
- Place farmland tiles via the Grass/Farmland options; removing paid farmland refunds its cost.
- Stats overlay shows ticker, change, estimated payout, and remaining grow time; you can hide it for a cleaner view.

## Run locally

- Open `index.html` in a modern browser
