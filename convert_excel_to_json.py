import pandas as pd
import json

# Read your Excel file
df = pd.read_excel('master_price_list.xlsx')
# Ensure columns match
df = df[['Brand', 'Part No', 'Root Part No', 'MRP', 'GST%']].rename(columns={
    'Part No': 'part_no',
    'Root Part No': 'root_part_no',
    'Brand': 'brand',
    'MRP': 'mrp',
    'GST%': 'gst_percent'
})
# Clean data
df['part_no'] = df['part_no'].astype(str).str.strip()
df['root_part_no'] = df['root_part_no'].astype(str).str.strip()
df['brand'] = df['brand'].astype(str).str.strip()
df['mrp'] = pd.to_numeric(df['mrp'], errors='coerce')
df['gst_percent'] = pd.to_numeric(df['gst_percent'], errors='coerce')
# Drop rows with invalid MRP/GST
df = df.dropna()
# Convert to JSON
df.to_json('public/master_price_list.json', orient='records', lines=False)
print(f"Converted {len(df)} rows to public/master_price_list.json")
