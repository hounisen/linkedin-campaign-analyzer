import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, Info } from 'lucide-react';

const LinkedInCampaignAnalyzer = () => {
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState(null);

  const benchmarks = {
    ctr: { excellent: 0.8, good: 0.5, poor: 0.3 },
    cpc: { excellent: 30, good: 50, poor: 80 },
    engagementRate: { excellent: 4, good: 2, poor: 1 }
  };

  const getScore = (metric, value) => {
    const b = benchmarks[metric];
    if (!b) return 'average';
    
    if (metric === 'cpc') {
      if (value <= b.excellent) return 'excellent';
      if (value <= b.good) return 'good';
      if (value <= b.poor) return 'average';
      return 'poor';
    } else {
      if (value >= b.excellent) return 'excellent';
      if (value >= b.good) return 'good';
      if (value >= b.poor) return 'average';
      return 'poor';
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError(null);
    setCampaigns(null);

    try {
      const Papa = await import('papaparse');
      const arrayBuffer = await file.arrayBuffer();
      
      // Prøv UTF-16LE først (LinkedIn standard)
      let fileContent;
      try {
        const decoder = new TextDecoder('utf-16le');
        fileContent = decoder.decode(arrayBuffer);
      } catch (e) {
        const decoder = new TextDecoder('utf-8');
        fileContent = decoder.decode(arrayBuffer);
      }

      // Find header-linjen
      const lines = fileContent.split('\n');
      let headerIndex = -1;
      
      for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('campaign name') && line.includes('impressions')) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        throw new Error('Kunne ikke finde data i filen. Sørg for at det er en Campaign Performance Report.');
      }

      // Parse CSV data
      const csvData = lines.slice(headerIndex).join('\n');
      
      Papa.default.parse(csvData, {
        header: true,
        delimiter: '\t',
        skipEmptyLines: true,
        complete: (results) => {
          processCampaignData(results.data);
        },
        error: (err) => {
          throw new Error('Kunne ikke læse filen: ' + err.message);
        }
      });

    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Der skete en fejl ved indlæsning af filen.');
    }
  };

  const processCampaignData = (data) => {
    if (!data || data.length === 0) {
      setError('Ingen kampagner fundet i filen');
      return;
    }

    // Gruppér per kampagne
    const campaignMap = {};
    
    data.forEach(row => {
      const campaignName = row['Campaign Name'];
      const campaignId = row['Campaign ID'];
      
      if (!campaignName || !campaignId) return;
      
      if (!campaignMap[campaignId]) {
        campaignMap[campaignId] = {
          id: campaignId,
          name: campaignName,
          impressions: 0,
          clicks: 0,
          spend: 0,
          conversions: 0,
          reactions: 0,
          comments: 0,
          shares: 0,
          socialActions: 0,
          clicksToLandingPage: 0,
          currency: row['Currency'] || 'USD'
        };
      }

      const c = campaignMap[campaignId];
      c.impressions += parseFloat(row['Impressions']) || 0;
      c.clicks += parseFloat(row['Clicks']) || 0;
      c.spend += parseFloat(row['Total Spent']) || 0;
      c.conversions += parseFloat(row['Leads']) || parseFloat(row['Conversions']) || 0;
      c.reactions += parseFloat(row['Reactions']) || 0;
      c.comments += parseFloat(row['Comments']) || 0;
      c.shares += parseFloat(row['Shares']) || 0;
      c.socialActions += parseFloat(row['Total Social Actions']) || 0;
      c.clicksToLandingPage += parseFloat(row['Clicks to Landing Page']) || 0;
    });

    // Beregn metrics for hver kampagne
    const processedCampaigns = Object.values(campaignMap).map(c => {
      const usdToDkk = 7.5;
      const spendDKK = c.currency === 'USD' ? c.spend * usdToDkk : c.spend;
      
      const ctr = c.impressions > 0 ? (c.clicks / c.impressions * 100) : 0;
      const cpc = c.clicks > 0 ? (spendDKK / c.clicks) : 0;
      const engagementRate = c.impressions > 0 ? ((c.reactions + c.comments + c.shares) / c.impressions * 100) : 0;
      const conversionRate = c.clicks > 0 ? (c.conversions / c.clicks * 100) : 0;
      const landingPageRate = c.clicks > 0 ? (c.clicksToLandingPage / c.clicks * 100) : 0;

      // Samlet score
      const scores = {
        ctr: getScore('ctr', ctr),
        cpc: getScore('cpc', cpc),
        engagementRate: getScore('engagementRate', engagementRate)
      };

      const scoreValues = { excellent: 4, good: 3, average: 2, poor: 1 };
      const totalScore = Object.values(scores).reduce((sum, s) => sum + scoreValues[s], 0);
      const overallScore = Math.round((totalScore / 12) * 100);

      return {
        ...c,
        spendDKK,
        ctr: ctr.toFixed(2),
        cpc: cpc.toFixed(2),
        engagementRate: engagementRate.toFixed(2),
        conversionRate: conversionRate.toFixed(2),
        landingPageRate: landingPageRate.toFixed(1),
        scores,
        overallScore
      };
    });

    // Sortér efter score
    processedCampaigns.sort((a, b) => b.overallScore - a.overallScore);
    
    setCampaigns(processedCampaigns);
  };

  const getScoreColor = (score) => {
    switch(score) {
      case 'excellent': return 'bg-green-50 border-green-300 text-green-800';
      case 'good': return 'bg-blue-50 border-blue-300 text-blue-800';
      case 'average': return 'bg-yellow-50 border-yellow-300 text-yellow-800';
      case 'poor': return 'bg-red-50 border-red-300 text-red-800';
      default: return 'bg-gray-50 border-gray-300 text-gray-800';
    }
  };

  const getScoreLabel = (score) => {
    const labels = {
      excellent: 'Fremragende',
      good: 'God',
      average: 'Gennemsnitlig',
      poor: 'Svag'
    };
    return labels[score] || 'N/A';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            LinkedIn Kampagne Analysator
          </h1>
          <p className="text-gray-600 mb-6">
            Upload din Campaign Performance Report fra LinkedIn
          </p>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <label className="cursor-pointer block">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition">
              <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <span className="text-lg font-medium text-gray-700 block mb-1">
                Upload LinkedIn CSV
              </span>
              <span className="text-sm text-gray-500">
                Campaign Performance Report (.csv)
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </label>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                <strong>Sådan henter du rapporten:</strong> LinkedIn Campaign Manager → Vælg kampagne → Analytics → Export → Campaign Performance Report
              </p>
            </div>
          </div>
        </div>

        {/* Kampagne oversigt */}
        {campaigns && campaigns.length > 0 && (
          <div className="space-y-6">
            {/* Samlet oversigt i toppen */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Samlet Performance Overview
              </h2>
              
              {(() => {
                const totals = campaigns.reduce((acc, c) => ({
                  impressions: acc.impressions + c.impressions,
                  clicks: acc.clicks + c.clicks,
                  spend: acc.spend + c.spendDKK,
                  conversions: acc.conversions + c.conversions,
                  socialActions: acc.socialActions + c.socialActions,
                  clicksToLandingPage: acc.clicksToLandingPage + c.clicksToLandingPage
                }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, socialActions: 0, clicksToLandingPage: 0 });

                const totalCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
                const totalCPC = totals.clicks > 0 ? (totals.spend / totals.clicks) : 0;
                const avgScore = campaigns.reduce((sum, c) => sum + c.overallScore, 0) / campaigns.length;

                return (
                  <>
                    {/* Nøgle-metrics grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                      {/* Total Clicks */}
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-lg border-2 border-blue-200 shadow-sm">
                        <div className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">Total Clicks</div>
                        <div className="text-3xl font-bold text-blue-900">{Math.round(totals.clicks).toLocaleString('da-DK')}</div>
                      </div>

                      {/* Total CTR */}
                      <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-5 rounded-lg border-2 border-indigo-200 shadow-sm">
                        <div className="text-xs font-semibold text-indigo-700 mb-1 uppercase tracking-wide">Samlet CTR</div>
                        <div className="text-3xl font-bold text-indigo-900">{totalCTR.toFixed(2)}%</div>
                      </div>

                      {/* Total Handlinger */}
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-lg border-2 border-purple-200 shadow-sm">
                        <div className="text-xs font-semibold text-purple-700 mb-1 uppercase tracking-wide">Handlinger</div>
                        <div className="text-3xl font-bold text-purple-900">{Math.round(totals.socialActions).toLocaleString('da-DK')}</div>
                        <div className="text-xs text-purple-700 mt-1">Social Actions</div>
                      </div>

                      {/* Total Spend */}
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-lg border-2 border-green-200 shadow-sm">
                        <div className="text-xs font-semibold text-green-700 mb-1 uppercase tracking-wide">Total Forbrug</div>
                        <div className="text-3xl font-bold text-green-900">{totals.spend.toFixed(0).toLocaleString('da-DK')} kr</div>
                      </div>

                      {/* Avg CPC */}
                      <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-5 rounded-lg border-2 border-amber-200 shadow-sm">
                        <div className="text-xs font-semibold text-amber-700 mb-1 uppercase tracking-wide">Gns. CPC</div>
                        <div className="text-3xl font-bold text-amber-900">{totalCPC.toFixed(2)} kr</div>
                      </div>

                      {/* Performance Score */}
                      <div className={`bg-gradient-to-br p-5 rounded-lg border-2 shadow-sm ${
                        avgScore >= 75 ? 'from-emerald-50 to-emerald-100 border-emerald-200' :
                        avgScore >= 60 ? 'from-sky-50 to-sky-100 border-sky-200' :
                        avgScore >= 45 ? 'from-yellow-50 to-yellow-100 border-yellow-200' :
                        'from-red-50 to-red-100 border-red-200'
                      }`}>
                        <div className={`text-xs font-semibold mb-1 uppercase tracking-wide ${
                          avgScore >= 75 ? 'text-emerald-700' :
                          avgScore >= 60 ? 'text-sky-700' :
                          avgScore >= 45 ? 'text-yellow-700' :
                          'text-red-700'
                        }`}>Performance</div>
                        <div className={`text-3xl font-bold ${
                          avgScore >= 75 ? 'text-emerald-900' :
                          avgScore >= 60 ? 'text-sky-900' :
                          avgScore >= 45 ? 'text-yellow-900' :
                          'text-red-900'
                        }`}>{avgScore.toFixed(0)}%</div>
                        <div className={`text-xs mt-1 ${
                          avgScore >= 75 ? 'text-emerald-700' :
                          avgScore >= 60 ? 'text-sky-700' :
                          avgScore >= 45 ? 'text-yellow-700' :
                          'text-red-700'
                        }`}>
                          {avgScore >= 75 ? 'Fremragende' :
                           avgScore >= 60 ? 'God' :
                           avgScore >= 45 ? 'Gennemsnitlig' : 'Svag'}
                        </div>
                      </div>
                    </div>

                    {/* Sekundære metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">Impressions</div>
                        <div className="text-xl font-bold text-gray-900">{Math.round(totals.impressions).toLocaleString('da-DK')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">→ Landing Page</div>
                        <div className="text-xl font-bold text-gray-900">{Math.round(totals.clicksToLandingPage).toLocaleString('da-DK')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">Conversions</div>
                        <div className="text-xl font-bold text-gray-900">{Math.round(totals.conversions)}</div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Kampagne sammenligning */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Kampagne Sammenligning
              </h2>
              <p className="text-gray-600 mb-4">
                {campaigns.length} kampagne{campaigns.length !== 1 ? 'r' : ''} analyseret
              </p>

              <div className="space-y-4">
                {campaigns.map((campaign, index) => (
                  <div
                    key={campaign.id}
                    className="border-2 border-gray-200 rounded-lg p-6 hover:shadow-md transition"
                  >
                    {/* Kampagne header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                          index === 0 ? 'bg-yellow-500' : 
                          index === 1 ? 'bg-gray-400' : 
                          index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {campaign.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Performance Score: <span className={`font-bold ${
                              campaign.overallScore >= 75 ? 'text-green-600' :
                              campaign.overallScore >= 60 ? 'text-blue-600' :
                              campaign.overallScore >= 45 ? 'text-yellow-600' : 'text-red-600'
                            }`}>{campaign.overallScore}%</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                      {/* Impressions */}
                      <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Impressions</div>
                        <div className="text-lg font-bold text-gray-900">
                          {Math.round(campaign.impressions).toLocaleString('da-DK')}
                        </div>
                      </div>

                      {/* Clicks */}
                      <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Clicks</div>
                        <div className="text-lg font-bold text-gray-900">
                          {Math.round(campaign.clicks)}
                        </div>
                      </div>

                      {/* CTR */}
                      <div className={`p-3 rounded border-2 ${getScoreColor(campaign.scores.ctr)}`}>
                        <div className="text-xs font-medium mb-1">CTR</div>
                        <div className="text-lg font-bold">{campaign.ctr}%</div>
                        <div className="text-xs mt-0.5">{getScoreLabel(campaign.scores.ctr)}</div>
                      </div>

                      {/* CPC */}
                      <div className={`p-3 rounded border-2 ${getScoreColor(campaign.scores.cpc)}`}>
                        <div className="text-xs font-medium mb-1">CPC</div>
                        <div className="text-lg font-bold">{campaign.cpc} kr</div>
                        <div className="text-xs mt-0.5">{getScoreLabel(campaign.scores.cpc)}</div>
                      </div>

                      {/* Engagement */}
                      <div className={`p-3 rounded border-2 ${getScoreColor(campaign.scores.engagementRate)}`}>
                        <div className="text-xs font-medium mb-1">Engagement</div>
                        <div className="text-lg font-bold">{campaign.engagementRate}%</div>
                        <div className="text-xs mt-0.5">
                          {Math.round(campaign.reactions + campaign.comments + campaign.shares)} total
                        </div>
                      </div>

                      {/* Landing Page */}
                      <div className="bg-blue-50 p-3 rounded border-2 border-blue-200">
                        <div className="text-xs text-blue-700 font-medium mb-1">→ Landing Page</div>
                        <div className="text-lg font-bold text-blue-900">
                          {Math.round(campaign.clicksToLandingPage)}
                        </div>
                        <div className="text-xs text-blue-700 mt-0.5">
                          {campaign.landingPageRate}% af clicks
                        </div>
                      </div>

                      {/* Handlinger */}
                      <div className="bg-purple-50 p-3 rounded border-2 border-purple-200">
                        <div className="text-xs text-purple-700 font-medium mb-1">Handlinger</div>
                        <div className="text-lg font-bold text-purple-900">
                          {Math.round(campaign.socialActions)}
                        </div>
                        <div className="text-xs text-purple-700 mt-0.5">
                          Social actions
                        </div>
                      </div>
                    </div>

                    {/* Forbrug */}
                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                      <div>
                        <span className="text-sm text-gray-600">Total forbrug: </span>
                        <span className="font-bold text-gray-900">
                          {campaign.spend.toFixed(2)} {campaign.currency}
                        </span>
                        {campaign.currency === 'USD' && (
                          <span className="text-sm text-gray-600 ml-2">
                            (≈ {campaign.spendDKK.toFixed(2)} DKK)
                          </span>
                        )}
                      </div>
                      {campaign.conversions > 0 && (
                        <div className="text-sm text-gray-600">
                          <span className="font-semibold">{Math.round(campaign.conversions)}</span> conversions
                          <span className="mx-2">·</span>
                          <span>{campaign.conversionRate}% rate</span>
                        </div>
                      )}
                    </div>

                    {/* Top performer badge */}
                    {index === 0 && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-green-800">
                            <strong>Top Performer:</strong> Denne kampagne har den bedste samlede performance. 
                            Analyser creative, tekst og targeting for at replikere succesen.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Opsummering og konklusion */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg shadow-lg p-8 border-2 border-indigo-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Info className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Samlet Opsummering & Konklusion
                  </h3>
                  <p className="text-sm text-gray-600">
                    Baseret på {campaigns.length} kampagne{campaigns.length !== 1 ? 'r' : ''}
                  </p>
                </div>
              </div>

              {(() => {
                // Beregn totaler
                const totals = campaigns.reduce((acc, c) => ({
                  impressions: acc.impressions + c.impressions,
                  clicks: acc.clicks + c.clicks,
                  spend: acc.spend + c.spendDKK,
                  conversions: acc.conversions + c.conversions
                }), { impressions: 0, clicks: 0, spend: 0, conversions: 0 });

                const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
                const avgCPC = totals.clicks > 0 ? (totals.spend / totals.clicks) : 0;
                const avgScore = campaigns.reduce((sum, c) => sum + c.overallScore, 0) / campaigns.length;

                // Identificer top og bottom performers
                const topPerformer = campaigns[0];
                const bottomPerformer = campaigns[campaigns.length - 1];
                const scoreDiff = topPerformer.overallScore - bottomPerformer.overallScore;

                // Find bedste på specifikke metrics
                const bestCTR = campaigns.reduce((best, c) => parseFloat(c.ctr) > parseFloat(best.ctr) ? c : best);
                const bestEngagement = campaigns.reduce((best, c) => parseFloat(c.engagementRate) > parseFloat(best.engagementRate) ? c : best);
                const mostLandingPageClicks = campaigns.reduce((best, c) => c.clicksToLandingPage > best.clicksToLandingPage ? c : best);

                // Generer insights
                const insights = [];

                // Overall performance
                if (avgScore >= 75) {
                  insights.push({
                    type: 'success',
                    title: '🎉 Stærk samlet performance',
                    text: `Kampagnerne performer generelt fremragende med en gennemsnitlig score på ${avgScore.toFixed(0)}%. Budgettet er godt investeret.`
                  });
                } else if (avgScore >= 60) {
                  insights.push({
                    type: 'info',
                    title: '✅ God samlet performance',
                    text: `Kampagnerne lever generelt godt med en gennemsnitlig score på ${avgScore.toFixed(0)}%. Der er potentiale for optimering.`
                  });
                } else if (avgScore >= 45) {
                  insights.push({
                    type: 'warning',
                    title: '⚠️ Gennemsnitlig performance',
                    text: `Kampagnerne scorer gennemsnitligt (${avgScore.toFixed(0)}%). Betydelig optimering anbefales for at forbedre ROI.`
                  });
                } else {
                  insights.push({
                    type: 'critical',
                    title: '🚨 Kritisk - handling påkrævet',
                    text: `Kampagnerne underperformer markant (${avgScore.toFixed(0)}%). Umiddelbar handling er nødvendig for at undgå budget-spild.`
                  });
                }

                // Budget og effektivitet
                insights.push({
                  type: 'neutral',
                  title: '💰 Budget & Effektivitet',
                  text: `Total forbrug: ${totals.spend.toFixed(0)} DKK genererede ${Math.round(totals.clicks)} clicks (Ø CPC: ${avgCPC.toFixed(2)} kr) og ${Math.round(totals.conversions)} conversions.`
                });

                // Top performer analyse
                if (campaigns.length > 1) {
                  insights.push({
                    type: 'success',
                    title: '🏆 Top Performer',
                    text: `"${topPerformer.name}" er den stærkeste kampagne med ${topPerformer.overallScore}% score. Denne kampagne har en CTR på ${topPerformer.ctr}% og CPC på ${topPerformer.cpc} kr.`
                  });
                }

                // Specifik metric champions
                if (campaigns.length > 1) {
                  const champions = [];
                  if (parseFloat(bestCTR.ctr) >= 0.5) {
                    champions.push(`"${bestCTR.name}" har den bedste CTR (${bestCTR.ctr}%) - kreativ/tekst fanger målgruppens opmærksomhed`);
                  }
                  if (parseFloat(bestEngagement.engagementRate) >= 2) {
                    champions.push(`"${bestEngagement.name}" skaber mest engagement (${bestEngagement.engagementRate}%) - budskabet resonerer stærkt`);
                  }
                  if (mostLandingPageClicks.clicksToLandingPage > 10) {
                    champions.push(`"${mostLandingPageClicks.name}" driver mest kvalificeret trafik med ${Math.round(mostLandingPageClicks.clicksToLandingPage)} landing page clicks`);
                  }

                  if (champions.length > 0) {
                    insights.push({
                      type: 'info',
                      title: '⭐ Nøgle-succeser',
                      text: champions.join('. ') + '.'
                    });
                  }
                }

                // Performance gap analyse
                if (campaigns.length > 1 && scoreDiff > 20) {
                  insights.push({
                    type: 'warning',
                    title: '📊 Stor performance-forskel',
                    text: `Der er ${scoreDiff} point forskel mellem bedste og dårligste kampagne. Analyser hvad "${topPerformer.name}" gør anderledes: kreativ, tekst, targeting eller tilbud.`
                  });
                }

                // Svage kampagner
                const weakCampaigns = campaigns.filter(c => c.overallScore < 45);
                if (weakCampaigns.length > 0) {
                  insights.push({
                    type: 'critical',
                    title: '⛔ Underperformers',
                    text: `${weakCampaigns.length} kampagne(r) scorer under 45%. Overvej at pause disse og omlægge budget til top performers: ${weakCampaigns.map(c => `"${c.name}"`).join(', ')}.`
                  });
                }

                // Anbefalinger
                const recommendations = [];
                
                if (avgScore >= 75) {
                  recommendations.push('Skalér top performere ved at øge budget gradvist med 20-30%');
                  recommendations.push('Dokumentér succesfaktorerne til fremtidige kampagner');
                  recommendations.push('Test lignende målgrupper med samme kreative vinkel');
                } else if (avgScore >= 60) {
                  recommendations.push('Allokér mere budget til top 2 performende kampagner');
                  recommendations.push('A/B test variationer af best performers');
                  recommendations.push('Fjern underperformerende målgruppesegmenter');
                } else if (avgScore >= 45) {
                  recommendations.push('Revider annonce-creative og budskaber grundigt');
                  recommendations.push('Analysér målgruppens demografi og adfærd i Campaign Manager');
                  recommendations.push('Test forskellige bud-strategier og ad formats');
                  recommendations.push('Pause lavt-performerende kampagner');
                } else {
                  recommendations.push('STOP underperformerende kampagner øjeblikkeligt');
                  recommendations.push('Gennemfør grundig analyse af målgruppe-fit');
                  recommendations.push('Revurdér hele kampagnestrategi fra bunden');
                  recommendations.push('Test helt nye creatives med andre value propositions');
                  recommendations.push('Konsulter med LinkedIn kampagne-eksperter');
                }

                return (
                  <>
                    {/* Key Insights */}
                    <div className="space-y-4 mb-8">
                      {insights.map((insight, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border-l-4 ${
                            insight.type === 'success' ? 'bg-green-50 border-green-500' :
                            insight.type === 'info' ? 'bg-blue-50 border-blue-500' :
                            insight.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                            insight.type === 'critical' ? 'bg-red-50 border-red-500' :
                            'bg-gray-50 border-gray-500'
                          }`}
                        >
                          <h4 className="font-bold text-gray-900 mb-1">{insight.title}</h4>
                          <p className="text-sm text-gray-700">{insight.text}</p>
                        </div>
                      ))}
                    </div>

                    {/* Recommendations */}
                    <div className="bg-white rounded-lg p-6 shadow-sm">
                      <h4 className="text-lg font-bold text-gray-900 mb-4">
                        📋 Handlingsrettede Anbefalinger
                      </h4>
                      <div className="space-y-3">
                        {recommendations.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </div>
                            <p className="text-gray-700">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Konklusion */}
                    <div className="mt-6 p-6 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg text-white">
                      <h4 className="text-xl font-bold mb-2">💡 Konklusion</h4>
                      <p className="text-indigo-100 leading-relaxed">
                        {avgScore >= 75 ? (
                          <>Kampagnerne performer fremragende. Fortsæt den nuværende strategi og skalér top performers. Budgettet er effektivt investeret med stærk ROI.</>
                        ) : avgScore >= 60 ? (
                          <>Kampagnerne leverer solid værdi, men der er potentiale for forbedring. Fokusér på at optimere top performers og eliminere ineffektive elementer.</>
                        ) : avgScore >= 45 ? (
                          <>Kampagnerne kræver betydelig optimering. Revurdér targeting, kreativ og budskaber. Overvej at pause svage kampagner og koncentrér budget på potentielt stærke vinkler.</>
                        ) : (
                          <>Kritisk situation - kampagnerne underperformer markant. Umiddelbar handling påkrævet. Stop svage kampagner, revurdér strategi fra bunden, og test nye tilgange før yderligere budget investeres.</>
                        )}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Original Benchmarks sektion */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Evalueringskriterier
              </h3>
              <div className="grid md:grid-cols-3 gap-6 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">CTR</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      Fremragende: ≥0.8%
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      God: ≥0.5%
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      Gennemsnitlig: ≥0.3%
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      Svag: &lt;0.3%
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">CPC (DKK)</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      Fremragende: ≤30 kr
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      God: ≤50 kr
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      Gennemsnitlig: ≤80 kr
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      Svag: &gt;80 kr
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Engagement Rate</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      Fremragende: ≥4%
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      God: ≥2%
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      Gennemsnitlig: ≥1%
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      Svag: &lt;1%
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkedInCampaignAnalyzer;
