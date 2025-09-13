import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import Fuse from 'fuse.js';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [masterData, setMasterData] = useState([]);
  const [masterLoaded, setMasterLoaded] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const [results, setResults] = useState([]);

  // Load master price list on mount
  useEffect(() => {
    fetch('/master_price_list.json')
      .then(response => response.json())
      .then(data => {
        setMasterData(data);
        setMasterLoaded(true);
        toast.success('Master price list loaded!');
      })
      .catch(error => {
        console.error('Error loading master:', error);
        toast.error('Failed to load master price list');
      });
  }, []);

  const handleInvoiceUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setInvoiceFile(file);
  };

  const calculateExpectedListPrice = (mrp, gst) => {
    if (gst === 28) return mrp / 1.28;
    if (gst === 18) return mrp / 1.18;
    throw new Error(`Unsupported GST: ${gst}`);
  };

  const similarity = (a, b) => {
    const fuse = new Fuse([b], { keys: ['value'], threshold: 0.1 }); // 0.1 = ~90% similarity
    const result = fuse.search(a);
    return result.length > 0 ? 1 - result[0].score : 0;
  };

  const processInvoice = () => {
    if (!invoiceFile) {
      toast.error('Please select a CSV invoice file');
      return;
    }
    setProcessing(true);
    Papa.parse(invoiceFile, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const data = result.data;
        const requiredCols = ['Part No', 'Supplier Price'];
        if (!requiredCols.every(col => col in data[0])) {
          toast.error(`Missing columns: ${requiredCols.filter(col => !(col in data[0])).join(', ')}`);
          setProcessing(false);
          return;
        }

        let match_count = 0, mismatch_count = 0, not_found_count = 0, possible_count = 0;
        const results = [];

        data.forEach(row => {
          const part_no = row['Part No']?.trim();
          let supplier_price;
          try {
            supplier_price = parseFloat(row['Supplier Price']);
            if (isNaN(supplier_price)) throw new Error('Invalid price');
          } catch {
            toast.error(`Invalid Supplier Price for Part No: ${part_no}`);
            return;
          }

          // Exact match
          let exact_match = masterData.find(item => item.part_no === part_no || item.root_part_no === part_no);
          let remark, expected;

          if (exact_match) {
            try {
              expected = calculateExpectedListPrice(exact_match.mrp, exact_match.gst_percent);
              remark = Math.abs(expected - supplier_price) < 0.01 ? 'MATCH' : 'NOT MATCH';
              if (remark === 'MATCH') match_count++;
              else mismatch_count++;
            } catch (e) {
              remark = 'ERROR: ' + e.message;
              mismatch_count++;
            }
          } else {
            // Fuzzy match
            const best_match = masterData.reduce((best, item) => {
              const score = similarity(part_no, item.part_no);
              return score > best.score ? { item, score } : best;
            }, { item: null, score: 0 });

            if (best_match.score >= 0.9) {
              exact_match = best_match.item;
              expected = calculateExpectedListPrice(exact_match.mrp, exact_match.gst_percent);
              remark = 'POSSIBLE MATCH';
              possible_count++;
            } else {
              remark = 'NOT IN PRICE LIST';
              not_found_count++;
              exact_match = null;
            }
          }

          results.push({
            'Brand': exact_match ? exact_match.brand : '',
            'Part No': part_no,
            'Root Part No': exact_match ? exact_match.root_part_no : '',
            'MRP': exact_match ? exact_match.mrp : '',
            'GST%': exact_match ? exact_match.gst_percent : '',
            'Expected List Price': exact_match ? expected : '',
            'Supplier Price': supplier_price,
            'Remark': remark
          });
        });

        setResults(results);
        setSummary({
          total: data.length,
          matched: match_count,
          mismatched: mismatch_count,
          not_found: not_found_count,
          possible_match: possible_count
        });
        setDownloadReady(true);
        toast.success('Invoice processed successfully!');
        setProcessing(false);
      },
      error: (error) => {
        toast.error('Error parsing CSV: ' + error.message);
        setProcessing(false);
      }
    });
  };

  const downloadResult = () => {
    if (!results.length) {
      toast.error('No results to download');
      return;
    }
    const csv = Papa.unparse(results);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'price_check_results.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Supplier Invoice Price Checker</h1>
        
        {/* Master Status */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">1. Master Price List</h2>
          {masterLoaded ? (
            <p className="text-green-600">✓ Master price list loaded ({masterData.length} entries).</p>
          ) : (
            <p className="text-red-600">Loading master price list...</p>
          )}
        </div>

        {/* Invoice Upload Section */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">2. Upload Supplier Invoice</h2>
          <a
            href="/sample_supplier_invoice.csv"
            download="sample_supplier_invoice.csv"
            className="mb-4 inline-block bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600"
          >
            Download Sample Invoice (CSV)
          </a>
          <input
            type="file"
            accept=".csv"
            onChange={handleInvoiceUpload}
            disabled={processing}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 mb-4"
          />
          <button
            onClick={processInvoice}
            disabled={!invoiceFile || processing || !masterLoaded}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Processing...' : 'Process Invoice'}
          </button>
        </div>

        {/* Progress Bar */}
        {processing && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full animate-pulse" style={{width: '60%'}}></div>
            </div>
            <p className="text-center mt-2">Checking prices...</p>
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Processing Summary</h2>
            <p className="text-lg">
              {summary.total} items checked → {summary.matched} matched, {summary.mismatched} mismatched, {summary.not_found} not in price list, {summary.possible_match} possible matches.
            </p>
          </div>
        )}

        {/* Download Button */}
        {downloadReady && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <button
              onClick={downloadResult}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
            >
              Download Result CSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;