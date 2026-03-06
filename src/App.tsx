/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { DealCategory, Deal } from './types';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function parseDeals(rawText: string): DealCategory[] {
  console.log('Parsing raw text:', rawText);
  const categories: DealCategory[] = [];
  let currentCategory: DealCategory | null = null;

  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l !== '');

  lines.forEach((line, index) => {
    // More flexible category detection
    const categoryMatch = line.match(/^(?:#+|-)\s*(?:🍕|🛒|🎁)?\s*(FOOD|GROCERIES|FREEBIES)/i);
    
    if (categoryMatch) {
      const categoryName = categoryMatch[1].toUpperCase();
      currentCategory = { category: categoryName, deals: [] };
      categories.push(currentCategory);
      console.log('Found category:', categoryName);
    } else if (currentCategory && (line.startsWith('- ⭐') || line.startsWith('⭐'))) {
      const nameMatch = line.match(/(?:- )?⭐\s*(?:\*\*)?(.*?)(?:\*\*)?$/);
      const name = nameMatch ? nameMatch[1].trim() : 'Unknown Business';

      let win = 'No unicorn win found';
      let where = 'Unknown Location';
      let action = 'No immediate action';

      // Dynamically search for win, where, and action lines in the next few lines
      for (let i = index + 1; i < Math.min(index + 10, lines.length); i++) {
        const currentDetailLine = lines[i];
        
        if (currentDetailLine.includes('🦄')) {
          win = currentDetailLine.replace(/.*🦄\s*(?:\*\*THE UNICORN WIN:\*\*)?\s*/i, '').trim();
        } else if (currentDetailLine.includes('📍')) {
          where = currentDetailLine.replace(/.*📍\s*(?:\*\*WHERE:\*\*)?\s*/i, '').trim();
        } else if (currentDetailLine.includes('🕒')) {
          action = currentDetailLine.replace(/.*🕒\s*(?:\*\*DO THIS NOW:\*\*)?\s*/i, '').trim();
        }
        
        // Stop if we hit the next deal or category
        if (lines[i].match(/^(?:#+|-)\s*(?:🍕|🛒|🎁|⭐)/)) {
          break;
        }
      }

      currentCategory.deals.push({ name, win, where, action });
      console.log('Found deal:', { name, win, where, action });
    }
  });

  // Fallback: If no categories found but text exists, try to find deals globally
  if (categories.length === 0) {
    console.log('No categories found, attempting global deal search...');
    const globalDeals: Deal[] = [];
    lines.forEach((line, index) => {
      if (line.includes('⭐')) {
         // ... similar logic for global search if needed ...
      }
    });
  }

  return categories;
}

interface DealCategoryCardProps {
  categoryData: DealCategory;
}

const DealCategoryCard: React.FC<DealCategoryCardProps> = ({ categoryData }) => {
  const categoryColor = useMemo(() => {
    switch (categoryData.category) {
      case 'FOOD': return 'bg-red-100 border-red-300 text-red-800';
      case 'GROCERIES': return 'bg-green-100 border-green-300 text-green-800';
      case 'FREEBIES': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default: return 'bg-purple-100 border-purple-300 text-purple-800';
    }
  }, [categoryData.category]);

  return (
    <div className={`p-6 rounded-2xl border-2 shadow-lg ${categoryColor} max-h-96 overflow-y-auto custom-scrollbar`}>
      <h3 className="text-3xl font-bold mb-4 font-serif">{categoryData.category}</h3>
      <div className="space-y-4">
        {categoryData.deals.map((deal, dealIndex) => (
          <div key={dealIndex} className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
            <p className="text-xl font-semibold text-purple-700 mb-1">⭐ {deal.name}</p>
            <p className="text-lg text-gray-700 mb-1">🦄 <span className="font-medium">THE UNICORN WIN:</span> {deal.win}</p>
            <p className="text-md text-gray-600 mb-1">📍 <span className="font-medium">WHERE:</span> {deal.where}</p>
            <p className="text-md text-gray-600">🕒 <span className="font-medium">DO THIS NOW:</span> {deal.action}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

function App() {
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [category, setCategory] = useState('');
  const [deals, setDeals] = useState<DealCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setDeals([]);
    setRawResponse(null);
    try {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const prompt = `SEARCH THE WEB for real, current "Unicorn" deals (BOGO, 50% Off, 100% Free) for today (${today}) in ${city}, ${country} ${zipCode ? `(Zip Code: ${zipCode})` : ''} for the category: ${category}. 

CRITICAL: You MUST use the following format for EVERY deal found:

### 🍕 FOOD
- ⭐ **[BUSINESS NAME]**
- 🦄 **THE UNICORN WIN:** [Deal description]
- 📍 **WHERE:** [Address or Link]
- 🕒 **DO THIS NOW:** [Immediate step]

### 🛒 GROCERIES
- ⭐ **[STORE NAME]**
- 🦄 **THE UNICORN WIN:** [Deal description]
- 📍 **WHERE:** [Address]
- 🕒 **DO THIS NOW:** [Immediate step]

### 🎁 FREEBIES
- ⭐ **[NAME]**
- 🦄 **THE UNICORN WIN:** [Deal description]
- 📍 **WHERE:** [Location]
- 🕒 **DO THIS NOW:** [Immediate step]

If you find no deals, explain why.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      
      const text = response.text || '';
      setRawResponse(text);
      const parsedDeals = parseDeals(text);
      setDeals(parsedDeals);
    } catch (error) {
      console.error('Error fetching deals:', error);
      setRawResponse(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex flex-col items-center p-4 sm:p-8">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl w-full max-w-4xl transform transition-all duration-300">
        <h1 className="text-4xl sm:text-6xl font-extrabold text-center text-purple-800 mb-8 font-serif tracking-tight leading-tight">
          🦄 Unicorn Deal Scout 🦄
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <input
            type="text"
            placeholder="City (e.g., Austin)"
            className="p-3 border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none shadow-sm"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <input
            type="text"
            placeholder="Country (e.g., USA)"
            className="p-3 border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none shadow-sm"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <input
            type="text"
            placeholder="Zip Code (Optional)"
            className="p-3 border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none shadow-sm"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
          />
          <input
            type="text"
            placeholder="Deal Category (e.g., Pizza, Groceries)"
            className="p-3 border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none shadow-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={loading || !city || !country || !category}
          className="w-full bg-purple-600 text-white p-4 rounded-xl text-xl font-bold hover:bg-purple-700 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mb-8"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Scouting for Deals...
            </>
          ) : (
            'Find My Unicorn Deals!'
          )}
        </button>

        {deals.length > 0 ? (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-purple-700 mb-6 text-center font-serif">Your Unicorn Wins!</h2>
            <div className="flex flex-col gap-6">
              {deals.map((categoryData, index) => (
                <DealCategoryCard key={index} categoryData={categoryData} />
              ))}
            </div>
          </div>
        ) : !loading && rawResponse ? (
          <div className="mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-200">
            <h2 className="text-xl font-bold text-gray-700 mb-4">No structured deals found.</h2>
            <p className="text-gray-600 mb-4 italic">Here is what the scout found (Raw Report):</p>
            <div className="bg-white p-4 rounded-xl border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar">
              {rawResponse}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;
