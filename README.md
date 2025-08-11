# MTG Cube Manager React App

This project is a React web app for managing Magic The Gathering decks and cubes.  
You can add decks from text files, select which decks to include, rename or remove decks, and download your cube as JSON.  

## Live Demo

Access the deployed app here:  
https://Jakerem1.github.io/mtg-cube-tool-react/

---

## How to run locally

1. Clone the repo:  
   ```bash
   git clone https://github.com/Jakerem1/mtg-cube-tool-react.git
   cd mtg-cube-tool-react
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm start
   ```

4. Open your browser and go to `http://localhost:3000`.

---

## How to deploy to GitHub Pages

1. Make sure `homepage` is set correctly in `package.json`:

   ```json
   "homepage": "https://Jakerem1.github.io/mtg-cube-tool-react"
   ```

2. Make sure these scripts exist in `package.json`:

   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d build",
     // other scripts...
   }
   ```

3. Install `gh-pages` package if not installed:

   ```bash
   npm install --save-dev gh-pages
   ```

4. Deploy the app:

   ```bash
   npm run deploy
   ```

5. Enable GitHub Pages in your repo settings to use the `gh-pages` branch as the source.

6. Visit your live app at:
   `https://Jakerem1.github.io/mtg-cube-tool-react/`

---

## License

MIT License

---

Enjoy managing your MTG decks and cubes!