# Supplier Invoice Price Checker

A static React app for checking supplier invoice prices against a master price list. Deployable on Netlify.

## Setup
1. Install dependencies: `npm install`
2. Place `master_price_list.json` in `public/` (convert from Excel using `convert_excel_to_json.py`).
3. Run locally: `npm start`
4. Build for production: `npm run build`
5. Deploy to Netlify: Push to GitHub and connect to Netlify with `netlify.toml`.

## Usage
- Download `sample_supplier_invoice.csv` from the UI.
- Edit CSV with `Part No` and `Supplier Price`.
- Upload CSV, process, and download results as CSV.