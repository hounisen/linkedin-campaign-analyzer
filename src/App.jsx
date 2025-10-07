import React, { useState } from 'react';
import { Upload, TrendingUp, TrendingDown, AlertCircle, CheckCircle, FileText, Info } from 'lucide-react';

const LinkedInCampaignAnalyzer = () => {
  const [campaignData, setCampaignData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [campaignBreakdown, setCampaignBreakdown] = useState(null);
  const [error, setError] = useState(null);
  const [criteria, setCriteria] = useState({
    ctr: { excellent: 0.8, good: 0.5, poor: 0.3 },
    cpc: { excellent: 30, good: 50, poor: 80 },
    conversionRate: { excellent: 3, good: 2, poor: 1 },
    engagementRate: { excellent: 4, good: 2, poor: 1 },
    cpl: { excellent: 300, good: 500, poor: 800 }
  });

  const getScore = (metric, value) => {
    const c = criteria[metric];
    if (!c) return 'unknown';
    
    if (metric === 'cpc' || metric === 'cpl') {
      if (value <= c.excellent) return 'excellent';
      if (value <= c.good) return 'good';
      if (value <= c.poor) return 'average';
      return 'poor';
    } else {
      if (value >= c.excellent) return 'excellent';
      if (value >= c.good) return 'good';
      if (value >= c.poor) return 'average';
      return 'poor';
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError(null);

    try {
      const Papa = await import('papaparse');
      
      const arrayBuffer = await file.arrayBuffer();
      
      let fileContent;
      let encodingUsed = 'unknown';
      
      // Prøv UTF-16LE først
      try {
        const decoder = new TextDecoder('utf-16le');
        fileContent = decoder.decode(arrayBuffer);
        // Tjek om det ser ud til at være valid UTF-16
        if (!fileContent.includes('�') && (fileContent.includes('Campaign') || fileContent.includes('Impressions'))) {
          encodingUsed = 'utf-16le';
          console.log('Successfully decoded as UTF-16LE');
        } else {
          throw new Error('Not valid UTF-16LE');
        }
      } catch (e) {
        console.log('UTF-16LE failed, trying UTF-8...');
        // Prøv UTF-8
        try {
          const decoder = new TextDecoder('utf-8');
          fileContent = decoder.decode(arrayBuffer);
          encodingUsed = 'utf-8';
          console.log('Successfully decoded as UTF-8');
        } catch (e2) {
          // Prøv Windows-1252 / CP1252
          console.log('UTF-8 failed, trying Windows-1252...');
          const decoder = new TextDecoder('windows-1252');
          fileContent = decoder.decode(arrayBuffer);
          encodingUsed = 'windows-1252';
          console.log('Successfully decoded as Windows-1252');
        }
      }

      console.log('Encoding used:', encodingUsed);
      console.log('File content length:', fileContent.length);

      const lines = fileContent.split('\n');
      const headerIndex = lines.findIndex(line => 
        line.includes('Start Date') || 
        line.includes('Campaign Name') || 
        line.includes('Impressions') ||
        line.includes('Campaign') // Bredere søgning
      );

      console.log('Total linjer i fil:', lines.length);
      console.log('Header index fundet:', headerIndex);
      console.log('Første 10 linjer:', lines.slice(0, 10).map((l, i) => `${i}: ${l.substring(0, 80)}`));

      if (headerIndex === -1) {
        throw new Error('Kunne ikke finde header-linjen i CSV-filen. Sørg for at filen er en Campaign Performance Report fra LinkedIn.');
      }

      const csvData = lines.slice(headerIndex).join('\n');
      const delimiter = csvData.includes('\t') ? '\t' : ',';

      Papa.default.parse(csvData, {
        header: true,
        delimiter: delimiter,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn('Parse warnings:', results.errors);
          }
          processCampaignData(results.data, results.meta.fields);
        },
        error: (error) => {
          throw new Error(`Parse fejl: ${error.message}`);
        }
      });
    } catch (error) {
      console.error('Upload fejl:', error);
      setError(`Fejl ved indlæsning: ${error.message}. Prøv venligst igen eller kontakt support.`);
    }
  };

  const handleManualInput = () => {
    const mockData = [
      {
        'Campaign Name': "Kampagne A: Value Proposition Focus",
        'Campaign ID': 1001,
        'Impressions': 25000,
        'Clicks': 200,
        'Total Spent': 1500,
        'Leads': 18,
        'Reactions': 95,
        'Comments': 12,
        'Shares': 8,
        'Currency': 'USD',
        'Clicks to Landing Page': 180
      },
      {
        'Campaign Name': "Kampagne B: Problem-Solution Angle",
        'Campaign ID': 1002,
        'Impressions': 20000,
        'Clicks': 115,
        'Total Spent': 980,
        'Leads': 10,
        'Reactions': 85,
        'Comments': 33,
        'Shares': 24,
        'Currency': 'USD',
        'Clicks to Landing Page': 95
      },
      {
        'Campaign Name': "Kampagne C: Testimonial Creative",
        'Campaign ID': 1003,
        'Impressions': 18000,
        'Clicks': 156,
        'Total Spent': 1100,
        'Leads': 22,
        'Reactions': 120,
        'Comments': 45,
        'Shares': 35,
        'Currency': 'USD',
        'Clicks to Landing Page': 142,
        'Total Social Actions': 200
      }
    ];
    processCampaignData(mockData);
  };

  const processCampaignData = (data, fields = null) => {
    if (!data || data.length === 0) {
      setError('Ingen data fundet i filen');
      return;
    }

    console.log('Processing data:', data.length, 'rows');
    if (fields) console.log('Available fields:', fields);

    const campaignGroups = {};
    
    data.forEach(row => {
      const campaignName = row['Campaign Name'] || row['Campaign Group Name'] || 'Unavngivet Kampagne';
      const campaignId = row['Campaign ID'] || campaignName;
      
      if (!campaignGroups[campaignId]) {
        campaignGroups[campaignId] = {
          name: campaignName,
          rows: []
        };
      }
      campaignGroups[campaignId].rows.push(row);
    });

    const campaignMetrics = Object.values(campaignGroups).map(campaign => {
      const totals = campaign.rows.reduce((acc, row) => {
        const impressions = row.Impressions || row.impressions || 0;
        const clicks = row.Clicks || row.clicks || 0;
        const spend = row['Total Spent'] || row.Spend || row.spend || row['Total Budget'] || 0;
        const conversions = row.Conversions || row.Leads || row.conversions || row.leads || 0;
        const reactions = row.Reactions || row.Likes || row.reactions || row.likes || 0;
        const comments = row.Comments || row.comments || 0;
        const shares = row.Shares || row.shares || 0;
        const currency = row.Currency || acc.currency || 'USD';
        const clicksToLandingPage = row['Clicks to Landing Page'] || 0;
        const totalSocialActions = row['Total Social Actions'] || 0;

        return {
          impressions: acc.impressions + impressions,
          clicks: acc.clicks + clicks,
          spend: acc.spend + spend,
          conversions: acc.conversions + conversions,
          reactions: acc.reactions + reactions,
          comments: acc.comments + comments,
          shares: acc.shares + shares,
          currency: currency,
          clicksToLandingPage: acc.clicksToLandingPage + clicksToLandingPage,
          totalSocialActions: acc.totalSocialActions + totalSocialActions
        };
      }, {
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        reactions: 0,
        comments: 0,
        shares: 0,
        currency: 'USD',
        clicksToLandingPage: 0,
        totalSocialActions: 0
      });

      const usdToDkkRate = 7.5;
      const spendDKK = totals.currency === 'USD' ? totals.spend * usdToDkkRate : totals.spend;

      const metrics = {
        name: campaign.name,
        ...totals,
        spendDKK: spendDKK,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions * 100).toFixed(2) : 0,
        cpc: totals.clicks > 0 ? (spendDKK / totals.clicks).toFixed(2) : 0,
        conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks * 100).toFixed(2) : 0,
        cpl: totals.conversions > 0 ? (spendDKK / totals.conversions).toFixed(2) : 0,
        engagementRate: totals.impressions > 0 ? 
          ((totals.reactions + totals.comments + totals.shares) / totals.impressions * 100).toFixed(2) : 0,
        totalEngagements: totals.reactions + totals.comments + totals.shares,
        landingPageClickRate: totals.clicks > 0 ? (totals.clicksToLandingPage / totals.clicks * 100).toFixed(1) : 0,
        socialActionsRate: totals.impressions > 0 ? (totals.totalSocialActions / totals.impressions * 100).toFixed(2) : 0
      };

      const scores = {
        ctr: getScore('ctr', parseFloat(metrics.ctr)),
        cpc: getScore('cpc', parseFloat(metrics.cpc)),
        conversionRate: getScore('conversionRate', parseFloat(metrics.conversionRate)),
        engagementRate: getScore('engagementRate', parseFloat(metrics.engagementRate))
      };

      const scoreValues = { excellent: 4, good: 3, average: 2, poor: 1 };
      const validScores = Object.values(scores).filter(s => s !== null);
      const totalScore = validScores.reduce((sum, score) => sum + scoreValues[score], 0);
      const maxScore = validScores.length * 4;
      const overallScore = (totalScore / maxScore * 100).toFixed(0);

      return {
        ...metrics,
        scores,
        overallScore: parseInt(overallScore)
      };
    });

    campaignMetrics.sort((a, b) => b.overallScore - a.overallScore);
    setCampaignBreakdown(campaignMetrics);

    const totals = data.reduce((acc, row) => {
      const impressions = row.Impressions || row.impressions || 0;
      const clicks = row.Clicks || row.clicks || 0;
      const spend = row['Total Spent'] || row.Spend || row.spend || row['Total Budget'] || 0;
      const conversions = row.Conversions || row.Leads || row.conversions || row.leads || 0;
      const reactions = row.Reactions || row.Likes || row.reactions || row.likes || 0;
      const comments = row.Comments || row.comments || 0;
      const shares = row.Shares || row.shares || 0;
      const currency = row.Currency || acc.currency || 'USD';
      const totalSocialActions = row['Total Social Actions'] || 0;

      return {
        impressions: acc.impressions + impressions,
        clicks: acc.clicks + clicks,
        spend: acc.spend + spend,
        conversions: acc.conversions + conversions,
        reactions: acc.reactions + reactions,
        comments: acc.comments + comments,
        shares: acc.shares + shares,
        campaignName: row['Campaign Group Name'] || acc.campaignName || 'LinkedIn Kampagne Gruppe',
        currency: currency,
        totalSocialActions: acc.totalSocialActions + totalSocialActions
      };
    }, {
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      reactions: 0,
      comments: 0,
      shares: 0,
      campaignName: '',
      currency: 'USD',
      totalSocialActions: 0
    });

    console.log('Aggregated totals:', totals);

    const usdToDkkRate = 7.5;
    const spendDKK = totals.currency === 'USD' ? totals.spend * usdToDkkRate : totals.spend;

    const calculated = {
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions * 100).toFixed(2) : 0,
      cpc: totals.clicks > 0 ? (spendDKK / totals.clicks).toFixed(2) : 0,
      conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks * 100).toFixed(2) : 0,
      cpl: totals.conversions > 0 ? (spendDKK / totals.conversions).toFixed(2) : 0,
              engagementRate: totals.impressions > 0 ? 
        ((totals.reactions + totals.comments + totals.shares) / totals.impressions * 100).toFixed(2) : 0,
      totalEngagements: totals.reactions + totals.comments + totals.shares,
      spendDKK: spendDKK,
      exchangeRate: usdToDkkRate,
      socialActionsRate: totals.impressions > 0 ? (totals.totalSocialActions / totals.impressions * 100).toFixed(2) : 0
    };

    setCampaignData({ 
      ...totals, 
      ...calculated, 
      name: totals.campaignName 
    });
    
    analyzeCampaign({ ...totals, ...calculated });
    setError(null);
  };

  const analyzeCampaign = (data) => {
    const scores = {
      ctr: getScore('ctr', parseFloat(data.ctr)),
      cpc: getScore('cpc', parseFloat(data.cpc)),
      conversionRate: getScore('conversionRate', parseFloat(data.conversionRate)),
      engagementRate: getScore('engagementRate', parseFloat(data.engagementRate)),
      cpl: data.conversions > 0 ? getScore('cpl', parseFloat(data.cpl)) : null
    };

    const scoreValues = { excellent: 4, good: 3, average: 2, poor: 1 };
    const validScores = Object.values(scores).filter(s => s !== null);
    const totalScore = validScores.reduce((sum, score) => sum + scoreValues[score], 0);
    const maxScore = validScores.length * 4;
    const overallScore = (totalScore / maxScore * 100).toFixed(0);

    let overallRating, verdict, recommendations;

    if (overallScore >= 75) {
      overallRating = 'Fremragende kampagne';
      verdict = 'Denne kampagne performer ekstremt godt og overgår industristandarder. Budgettet er godt investeret.';
      recommendations = [
        'Skalér kampagnen ved at øge budgettet gradvist med 20-30%',
        'Dokumentér succesfaktorerne (targeting, creative, budskaber) til fremtidige kampagner',
        'Test lignende målgrupper med samme vinkel',
        'Overvej at udvide til andre kanaler med lignende strategi'
      ];
    } else if (overallScore >= 60) {
      overallRating = 'God kampagne';
      verdict = 'Kampagnen performer over gennemsnittet og leverer solid værdi. Der er potentiale for optimering.';
      recommendations = [
        'Identificér top-performende annoncer og allokér mere budget til disse',
        'A/B test forskellige versioner af dine best performers',
        'Optimér målgruppesegmenter - fjern underperformende segmenter',
        'Fortsæt med at monitorere dagligt og justér bud-strategi'
      ];
    } else if (overallScore >= 45) {
      overallRating = 'Gennemsnitlig kampagne';
      verdict = 'Kampagnen leverer på nogle områder, men der er betydeligt rum for forbedring før den kan kaldes succesfuld.';
      recommendations = [
        'Gennemgå og revider annonce-creative og budskaber - test nye hooks',
        'Analysér målgruppens demografi og adfærd grundigt i Campaign Manager',
        'Test forskellige bud-strategier (automated vs manual bidding)',
        'Overvej at pause eller stop lavt-performerende annoncer',
        'Benchmark mod konkurrenters kommunikation og tilbud'
      ];
    } else {
      overallRating = 'Kampagne kræver handling';
      verdict = 'Kampagnen underperformer markant. Umiddelbar handling er nødvendig for at undgå yderligere budget-spild.';
      recommendations = [
        'STOP eller pause kampagnen øjeblikkeligt',
        'Gennemfør grundig analyse af målgruppe-fit og relevans',
        'Revurdér hele kampagnestrategi, værditilbud og budskaber fra bunden',
        'Test helt nye creatives med forskellige value propositions',
        'Overvej om LinkedIn er den rette kanal for dette mål',
        'Konsulter med LinkedIn kampagne-eksperter eller agentur'
      ];
    }

    const insights = [];
    
    if (scores.ctr === 'excellent') {
      insights.push({ type: 'success', text: 'Fremragende CTR - dine annoncer fanger målgruppens opmærksomhed effektivt. Dette er et stærkt fundament.' });
    } else if (scores.ctr === 'poor') {
      insights.push({ type: 'warning', text: 'Lav CTR indikerer at annoncerne ikke resonerer med målgruppen. Prøv nye hooks, visuals eller værditilbud.' });
    }

    if (data.conversions > 0) {
      if (scores.conversionRate === 'excellent') {
        insights.push({ type: 'success', text: 'Høj konverteringsrate viser stærk kampagne-relevans og effektiv landing page experience.' });
      } else if (scores.conversionRate === 'poor') {
        insights.push({ type: 'warning', text: 'Lav konverteringsrate - gennemgå landing page oplevelse, message match og formular-friktion.' });
      }
    } else {
      insights.push({ type: 'critical', text: 'Ingen conversions registreret. Tjek conversion tracking, eller revurdér kampagne-mål og targeting.' });
    }

    if (scores.cpc === 'poor' && scores.ctr === 'poor') {
      insights.push({ type: 'critical', text: 'Høj CPC kombineret med lav CTR er kritisk ineffektivt. Kampagnen er ikke omkostningseffektiv i sin nuværende form.' });
    }

    if (scores.engagementRate === 'excellent') {
      insights.push({ type: 'success', text: 'Stærk engagement-rate indikerer at indholdet skaber værdi og dialog. Dette bygger brand awareness.' });
    } else if (scores.engagementRate === 'poor' && data.impressions > 1000) {
      insights.push({ type: 'warning', text: 'Meget lav engagement trods gode impressions. Indholdet mangler måske relevans eller emotional appeal.' });
    }

    if (data.conversions > 0 && scores.cpl === 'poor') {
      insights.push({ type: 'warning', text: `Cost per lead (${data.cpl} kr) er for høj. Optimér targeting eller revurdér kampagnens viabilitet ved dette prisniveau.` });
    }

    if (parseFloat(data.cpc) > 100) {
      insights.push({ type: 'critical', text: 'Meget høj CPC indikerer enten stor konkurrence, dårligt quality score eller forkert bidding-strategi.' });
    }

    setAnalysis({
      scores,
      overallScore,
      overallRating,
      verdict,
      recommendations,
      insights
    });
  };

  const getScoreColor = (score) => {
    switch(score) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'average': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getScoreLabel = (score) => {
    switch(score) {
      case 'excellent': return 'Fremragende';
      case 'good': return 'God';
      case 'average': return 'Gennemsnitlig';
      case 'poor': return 'Svag';
      default: return 'N/A';
    }
  };

  const getInsightIcon = (type) => {
    switch(type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'critical': return <AlertCircle className="w-5 h-5 text-red-600" />;
      default: return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">LinkedIn Kampagne Analysator</h1>
        <p className="text-gray-600 mb-6">Upload din Campaign Performance Report fra LinkedIn Campaign Manager, eller test med demo-data</p>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex gap-4">
          <label className="flex-1 cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <span className="text-sm text-gray-600 block mb-1 font-medium">Upload LinkedIn CSV</span>
              <span className="text-xs text-gray-500">Campaign Performance Report</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </div>
          </label>
          
          <button
            onClick={handleManualInput}
            className="flex-1 border-2 border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition"
          >
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <span className="text-sm text-gray-600 block mb-1 font-medium">Brug demo-data</span>
            <span className="text-xs text-gray-500">Test værktøjet</span>
          </button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              <strong>Tip:</strong> I LinkedIn Campaign Manager, vælg din kampagne → Analytics → Export → Campaign Performance Report
            </p>
          </div>
        </div>
      </div>

      {campaignData && analysis && (
        <>
          <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Samlet Overview: {campaignData.name}</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Impressions</div>
                <div className="text-2xl font-bold text-gray-900">{campaignData.impressions.toLocaleString('da-DK')}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="text-sm text-gray-600 mb-1">Clicks</div>
                <div className="text-2xl font-bold text-blue-900">{campaignData.clicks.toLocaleString('da-DK')}</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="text-sm text-gray-600 mb-1">Conversions</div>
                <div className="text-2xl font-bold text-green-900">{campaignData.conversions}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="text-sm text-gray-600 mb-1">Total Forbrug</div>
                <div className="text-2xl font-bold text-purple-900">
                  {campaignData.spend.toLocaleString('da-DK', {minimumFractionDigits: 2, maximumFractionDigits: 2})} {campaignData.currency}
                </div>
                {campaignData.currency === 'USD' && (
                  <div className="text-sm text-purple-700 mt-1">
                    ≈ {campaignData.spendDKK.toLocaleString('da-DK', {minimumFractionDigits: 2, maximumFractionDigits: 2})} DKK
                    <span className="text-xs text-purple-600 ml-1">(kurs: {campaignData.exchangeRate})</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Samlet Vurdering</h3>
                <div className="text-3xl font-bold text-blue-600">{analysis.overallScore}%</div>
              </div>
              <div className="mb-2">
                <div className="text-lg font-semibold text-gray-900 mb-2">{analysis.overallRating}</div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${analysis.overallScore}%` }}
                  ></div>
                </div>
              </div>
              <p className="text-gray-700 mt-4">{analysis.verdict}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Performance Metrics</h3>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className={`border-2 rounded-lg p-4 ${getScoreColor(analysis.scores.ctr)}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium text-gray-700">Click-Through Rate</div>
                  <span className={`text-xs px-2 py-1 rounded font-semibold border ${getScoreColor(analysis.scores.ctr)}`}>
                    {getScoreLabel(analysis.scores.ctr)}
                  </span>
                </div>
                <div className="text-3xl font-bold">{campaignData.ctr}%</div>
                <div className="text-xs text-gray-600 mt-1">Benchmark: ≥0.5% god</div>
              </div>

              <div className={`border-2 rounded-lg p-4 ${getScoreColor(analysis.scores.cpc)}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium text-gray-700">Cost Per Click</div>
                  <span className={`text-xs px-2 py-1 rounded font-semibold border ${getScoreColor(analysis.scores.cpc)}`}>
                    {getScoreLabel(analysis.scores.cpc)}
                  </span>
                </div>
                <div className="text-3xl font-bold">{campaignData.cpc} kr</div>
                <div className="text-xs text-gray-600 mt-1">Benchmark: ≤50kr god</div>
              </div>

              <div className={`border-2 rounded-lg p-4 ${getScoreColor(analysis.scores.conversionRate)}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium text-gray-700">Conversion Rate</div>
                  <span className={`text-xs px-2 py-1 rounded font-semibold border ${getScoreColor(analysis.scores.conversionRate)}`}>
                    {getScoreLabel(analysis.scores.conversionRate)}
                  </span>
                </div>
                <div className="text-3xl font-bold">{campaignData.conversionRate}%</div>
                <div className="text-xs text-gray-600 mt-1">Benchmark: ≥2% god</div>
              </div>

              {campaignData.conversions > 0 && (
                <div className={`border-2 rounded-lg p-4 ${getScoreColor(analysis.scores.cpl)}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-medium text-gray-700">Cost Per Lead</div>
                    <span className={`text-xs px-2 py-1 rounded font-semibold border ${getScoreColor(analysis.scores.cpl)}`}>
                      {getScoreLabel(analysis.scores.cpl)}
                    </span>
                  </div>
                  <div className="text-3xl font-bold">{campaignData.cpl} kr</div>
                  <div className="text-xs text-gray-600 mt-1">Benchmark: ≤500kr god</div>
                </div>
              )}

              <div className={`border-2 rounded-lg p-4 ${getScoreColor(analysis.scores.engagementRate)}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium text-gray-700">Engagement Rate</div>
                  <span className={`text-xs px-2 py-1 rounded font-semibold border ${getScoreColor(analysis.scores.engagementRate)}`}>
                    {getScoreLabel(analysis.scores.engagementRate)}
                  </span>
                </div>
                <div className="text-3xl font-bold">{campaignData.engagementRate}%</div>
                <div className="text-xs text-gray-600 mt-1">Benchmark: ≥2% god</div>
              </div>

              <div className="border-2 rounded-lg p-4 bg-gray-50 border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium text-gray-700">Total Engagement</div>
                </div>
                <div className="text-3xl font-bold text-gray-900">{campaignData.totalEngagements}</div>
                <div className="text-xs text-gray-600 mt-1">{campaignData.reactions} reactions · {campaignData.comments} kommentarer · {campaignData.shares} delinger</div>
              </div>
            </div>
          </div>

          {analysis.insights.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Nøgleindsigter</h3>
              <div className="space-y-3">
                {analysis.insights.map((insight, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    {getInsightIcon(insight.type)}
                    <p className="text-gray-700 flex-1">{insight.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {campaignBreakdown && campaignBreakdown.length > 1 && (
            <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Kampagne-sammenligning</h3>
                <span className="text-sm text-gray-600">{campaignBreakdown.length} kampagner</span>
              </div>

              <div className="space-y-4">
                {campaignBreakdown.map((campaign, index) => (
                  <div key={index} className="border-2 rounded-lg p-6 hover:shadow-md transition">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                          }`}>
                            {index + 1}
                          </div>
                          <h4 className="text-lg font-bold text-gray-900">{campaign.name}</h4>
                        </div>
                        <div className="flex items-center gap-2 ml-11">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Performance Score:</span>
                            <span className={`font-bold text-lg ${
                              campaign.overallScore >= 75 ? 'text-green-600' :
                              campaign.overallScore >= 60 ? 'text-blue-600' :
                              campaign.overallScore >= 45 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {campaign.overallScore}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 ml-11">
                      <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Impressions</div>
                        <div className="text-lg font-bold text-gray-900">{campaign.impressions.toLocaleString('da-DK')}</div>
                      </div>

                      <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Clicks</div>
                        <div className="text-lg font-bold text-gray-900">{campaign.clicks.toLocaleString('da-DK')}</div>
                      </div>
                      
                      <div className={`p-3 rounded border-2 ${getScoreColor(campaign.scores.ctr)}`}>
                        <div className="text-xs font-medium mb-1">CTR</div>
                        <div className="text-lg font-bold">{campaign.ctr}%</div>
                        <div className="text-xs opacity-75 mt-0.5">{getScoreLabel(campaign.scores.ctr)}</div>
                      </div>

                      <div className={`p-3 rounded border-2 ${getScoreColor(campaign.scores.engagementRate)}`}>
                        <div className="text-xs font-medium mb-1">Engagement</div>
                        <div className="text-lg font-bold">{campaign.engagementRate}%</div>
                        <div className="text-xs opacity-75 mt-0.5">{campaign.totalEngagements} total</div>
                      </div>

                      <div className="bg-blue-50 p-3 rounded border-2 border-blue-200">
                        <div className="text-xs text-blue-700 font-medium mb-1">→ Landing Page</div>
                        <div className="text-lg font-bold text-blue-900">{campaign.clicksToLandingPage}</div>
                        <div className="text-xs text-blue-700 mt-0.5">{campaign.landingPageClickRate}% af clicks</div>
                      </div>

                      <div className="bg-purple-50 p-3 rounded border-2 border-purple-200">
                        <div className="text-xs text-purple-700 font-medium mb-1">Handlinger</div>
                        <div className="text-lg font-bold text-purple-900">{campaign.totalSocialActions || 0}</div>
                        <div className="text-xs text-purple-700 mt-0.5">{campaign.socialActionsRate}% rate</div>
                      </div>

                      <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Forbrug</div>
                        <div className="text-lg font-bold text-gray-900">{campaign.spendDKK.toLocaleString('da-DK', {maximumFractionDigits: 0})} kr</div>
                      </div>
                    </div>

                    {index === 0 && (
                      <div className="mt-4 ml-11 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-green-800">
                            <strong>Top Performer:</strong> Denne kampagne har den bedste samlede performance. Analyser creative, tekst og targeting for at replikere succesen.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Nøgleindsigter fra sammenligningen
                </h4>
                <div className="space-y-2 text-sm text-blue-800">
                  {(() => {
                    const insights = [];

                    const bestCTR = Math.max(...campaignBreakdown.map(c => parseFloat(c.ctr)));
                    const topCTRCampaign = campaignBreakdown.find(c => parseFloat(c.ctr) === bestCTR);
                    if (topCTRCampaign && parseFloat(topCTRCampaign.ctr) >= 0.5) {
                      insights.push(`📊 "${topCTRCampaign.name}" har den højeste CTR (${topCTRCampaign.ctr}%). Denne kreativ/tekst er mest fængende for målgruppen.`);
                    }

                    const bestEngagement = Math.max(...campaignBreakdown.map(c => parseFloat(c.engagementRate)));
                    const topEngagementCampaign = campaignBreakdown.find(c => parseFloat(c.engagementRate) === bestEngagement);
                    if (topEngagementCampaign && parseFloat(topEngagementCampaign.engagementRate) >= 1) {
                      insights.push(`💬 "${topEngagementCampaign.name}" skaber mest engagement (${topEngagementCampaign.engagementRate}% med ${topEngagementCampaign.totalEngagements} interaktioner). Budskabet resonerer stærkt.`);
                    }

                    const bestLandingPageClicks = Math.max(...campaignBreakdown.map(c => c.clicksToLandingPage));
                    const topLandingPageCampaign = campaignBreakdown.find(c => c.clicksToLandingPage === bestLandingPageClicks);
                    if (topLandingPageCampaign && topLandingPageCampaign.clicksToLandingPage > 0) {
                      insights.push(`🔗 "${topLandingPageCampaign.name}" driver mest trafik til landing page (${topLandingPageCampaign.clicksToLandingPage} clicks, ${topLandingPageCampaign.landingPageClickRate}% af total). Stærkt call-to-action.`);
                    }

                    const bestConvRate = Math.max(...campaignBreakdown.map(c => parseFloat(c.conversionRate)));
                    const topConvCampaign = campaignBreakdown.find(c => parseFloat(c.conversionRate) === bestConvRate);
                    if (topConvCampaign && topConvCampaign.conversions > 0 && parseFloat(topConvCampaign.conversionRate) >= 2) {
                      insights.push(`✅ "${topConvCampaign.name}" konverterer bedst (${topConvCampaign.conversionRate}% med ${topConvCampaign.conversions} leads). Stærk message-match mellem annonce og landing page.`);
                    }

                    const validCPCs = campaignBreakdown.filter(c => c.clicks > 0);
                    if (validCPCs.length > 0) {
                      const lowestCPC = Math.min(...validCPCs.map(c => parseFloat(c.cpc)));
                      const mostEfficient = validCPCs.find(c => parseFloat(c.cpc) === lowestCPC);
                      if (mostEfficient && parseFloat(mostEfficient.cpc) <= 50) {
                        insights.push(`💰 "${mostEfficient.name}" har laveste CPC (${mostEfficient.cpc} kr). Mest omkostningseffektiv til at generere clicks.`);
                      }
                    }

                    const weakCampaigns = campaignBreakdown.filter(c => c.overallScore < 45);
                    if (weakCampaigns.length > 0) {
                      const weakNames = weakCampaigns.map(c => `"${c.name}"`).join(', ');
                      insights.push(`⚠️ ${weakCampaigns.length} kampagne(r) underperformer markant (${weakNames}). Overvej at pause disse og omlægge budget til top performers.`);
                    }

                    if (campaignBreakdown.length > 1) {
                      const topPerformer = campaignBreakdown[0];
                      const worstPerformer = campaignBreakdown[campaignBreakdown.length - 1];
                      const scoreDiff = topPerformer.overallScore - worstPerformer.overallScore;
                      
                      if (scoreDiff > 20) {
                        insights.push(`🎯 Stor performance-forskel mellem kampagner (${scoreDiff} point). Analyser hvad "${topPerformer.name}" gør anderledes: kreativ, tekst, targeting, eller tilbud.`);
                      }
                    }

                    return insights.length > 0 ? insights.map((insight, i) => (
                      <p key={i} className="flex items-start gap-2">
                        <span>{insight}</span>
                      </p>
                    )) : (
                      <p>Sammenlign kampagnernes creatives, tekster og targeting for at identificere succesfaktorer.</p>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Handlingsrettede Anbefalinger</h3>
            <div className="space-y-3">
              {analysis.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <p className="text-gray-700">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Evalueringskriterier (B2B LinkedIn)</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              CTR (Click-Through Rate)
            </h4>
            <ul className="space-y-1.5 text-gray-600 ml-4">
              <li className="flex items-center gap-2">
                <span className="text-green-600">●</span> Fremragende: ≥0.8%
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-600">●</span> God: ≥0.5%
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-600">●</span> Gennemsnitlig: ≥0.3%
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-600">●</span> Svag: &lt;0.3%
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              CPC (Cost Per Click)
            </h4>
            <ul className="space-y-1.5 text-gray-600 ml-4">
              <li className="flex items-center gap-2">
                <span className="text-green-600">●</span> Fremragende: ≤30 kr
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-600">●</span> God: ≤50 kr
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-600">●</span> Gennemsnitlig: ≤80 kr
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-600">●</span> Svag: &gt;80 kr
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              Conversion Rate
            </h4>
            <ul className="space-y-1.5 text-gray-600 ml-4">
              <li className="flex items-center gap-2">
                <span className="text-green-600">●</span> Fremragende: ≥3%
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-600">●</span> God: ≥2%
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-600">●</span> Gennemsnitlig: ≥1%
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-600">●</span> Svag: &lt;1%
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              CPL (Cost Per Lead)
            </h4>
            <ul className="space-y-1.5 text-gray-600 ml-4">
              <li className="flex items-center gap-2">
                <span className="text-green-600">●</span> Fremragende: ≤300 kr
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-600">●</span> God: ≤500 kr
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-600">●</span> Gennemsnitlig: ≤800 kr
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-600">●</span> Svag: &gt;800 kr
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              Engagement Rate
            </h4>
            <ul className="space-y-1.5 text-gray-600 ml-4">
              <li className="flex items-center gap-2">
                <span className="text-green-600">●</span> Fremragende: ≥4%
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-600">●</span> God: ≥2%
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-600">●</span> Gennemsnitlig: ≥1%
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-600">●</span> Svag: &lt;1%
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-900">
            <strong>Note:</strong> Disse benchmarks er baseret på typiske B2B LinkedIn kampagner i Danmark. Juster kriterierne efter din specifikke branche, målgruppe og kampagnemål for mere præcise vurderinger.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LinkedInCampaignAnalyzer;
