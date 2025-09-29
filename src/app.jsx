import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, FileText, Info } from 'lucide-react';

const LinkedInCampaignAnalyzer = () => {
  const [campaignData, setCampaignData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [campaignBreakdown, setCampaignBreakdown] = useState(null);
  const [error, setError] = useState(null);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">LinkedIn Kampagne Analysator</h1>
        <p className="text-gray-600">Upload din Campaign Performance Report</p>
      </div>
    </div>
  );
};

export default LinkedInCampaignAnalyzer;
