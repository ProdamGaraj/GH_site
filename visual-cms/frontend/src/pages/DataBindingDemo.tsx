import React, { useState } from 'react'
import { 
  DataBindingProvider,
  useVariable,
  useToggle,
  useCounter,
  useTemplate,
  useCondition,
  VariablesEditor,
  PageDataSourcesEditor,
  type VariablesConfig,
  type PageDataConfig,
} from '@/features/dataBindings'

/**
 * Demo page for Data Binding System
 * Shows usage of variables, page data sources, and reactive bindings
 */
export const DataBindingDemo: React.FC = () => {
  // Demo settings state
  const [variablesConfig, setVariablesConfig] = useState<VariablesConfig>({
    variables: [
      { id: '1', name: 'counter', scope: 'page', type: 'number', defaultValue: 0, reactive: true },
      { id: '2', name: 'userName', scope: 'page', type: 'string', defaultValue: 'Guest', reactive: true },
      { id: '3', name: 'isLoggedIn', scope: 'page', type: 'boolean', defaultValue: false, reactive: true },
      { id: '4', name: 'selectedItems', scope: 'page', type: 'array', defaultValue: [], reactive: true },
      { id: '5', name: 'theme', scope: 'global', type: 'string', defaultValue: 'light', persist: true, reactive: true },
    ]
  })

  const [dataSourcesConfig, setDataSourcesConfig] = useState<PageDataConfig>({
    dataSources: [],
    variables: {},
    cachePolicy: 'cache-first'
  })

  const [activeTab, setActiveTab] = useState<'demo' | 'variables' | 'sources'>('demo')

  // Combine settings for provider
  const pageSettings = {
    dataSources: dataSourcesConfig,
    variables: variablesConfig
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Binding System Demo</h1>
        <p className="text-gray-600 mb-8">Interactive demonstration of the Variables and Page Data system</p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'demo', label: 'Live Demo' },
            { id: 'variables', label: 'Configure Variables' },
            { id: 'sources', label: 'Configure Data Sources' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <DataBindingProvider pageId="demo-page" settings={pageSettings}>
          {activeTab === 'demo' && <DemoContent />}
          
          {activeTab === 'variables' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <VariablesEditor
                config={variablesConfig}
                onChange={setVariablesConfig}
              />
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <PageDataSourcesEditor
                pageId="demo-page"
                config={dataSourcesConfig}
                onChange={setDataSourcesConfig}
              />
            </div>
          )}
        </DataBindingProvider>
      </div>
    </div>
  )
}

/**
 * Demo content using hooks
 */
const DemoContent: React.FC = () => {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Counter Demo */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Counter Variable</h3>
        <CounterDemo />
      </div>

      {/* Toggle Demo */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Boolean Toggle</h3>
        <ToggleDemo />
      </div>

      {/* Template Demo */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Strings</h3>
        <TemplateDemo />
      </div>

      {/* Condition Demo */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conditional Rendering</h3>
        <ConditionDemo />
      </div>

      {/* Page Data Demo */}
      <div className="bg-white rounded-xl shadow-sm p-6 col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Variable Overview</h3>
        <VariableOverview />
      </div>
    </div>
  )
}

const CounterDemo: React.FC = () => {
  const [count, increment, decrement, setCount] = useCounter('page', 'counter')

  return (
    <div className="space-y-4">
      <div className="text-center">
        <span className="text-5xl font-bold text-blue-600">{count}</span>
      </div>
      <div className="flex justify-center gap-2">
        <button
          onClick={decrement}
          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
        >
          -1
        </button>
        <button
          onClick={() => setCount(0)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Reset
        </button>
        <button
          onClick={increment}
          className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
        >
          +1
        </button>
      </div>
      <p className="text-sm text-gray-500 text-center">
        Using: <code className="bg-gray-100 px-1 rounded">useCounter('page', 'counter')</code>
      </p>
    </div>
  )
}

const ToggleDemo: React.FC = () => {
  const [isLoggedIn, toggle] = useToggle('page', 'isLoggedIn')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4">
        <span className={`text-lg ${isLoggedIn ? 'text-green-600' : 'text-red-600'}`}>
          {isLoggedIn ? '✓ Logged In' : '✗ Logged Out'}
        </span>
      </div>
      <div className="flex justify-center">
        <button
          onClick={toggle}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            isLoggedIn
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          {isLoggedIn ? 'Logout' : 'Login'}
        </button>
      </div>
      <p className="text-sm text-gray-500 text-center">
        Using: <code className="bg-gray-100 px-1 rounded">useToggle('page', 'isLoggedIn')</code>
      </p>
    </div>
  )
}

const TemplateDemo: React.FC = () => {
  const [userName, setUserName] = useVariable<string>('page', 'userName')
  const greeting = useTemplate('Hello, {$page.userName}! Welcome back.')

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
        <input
          type="text"
          value={userName || ''}
          onChange={(e) => setUserName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="Enter your name"
        />
      </div>
      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="text-blue-900">{greeting}</p>
      </div>
      <p className="text-sm text-gray-500">
        Template: <code className="bg-gray-100 px-1 rounded">Hello, {'{$page.userName}'}!</code>
      </p>
    </div>
  )
}

const ConditionDemo: React.FC = () => {
  const [count] = useVariable<number>('page', 'counter')
  const [isLoggedIn] = useVariable<boolean>('page', 'isLoggedIn')
  
  const showWelcome = useCondition('$page.isLoggedIn && $page.counter > 0')
  const showWarning = useCondition('$page.counter < 0')

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        <p>Current state: counter = {count}, isLoggedIn = {String(isLoggedIn)}</p>
      </div>
      
      {showWelcome && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">Welcome! You are logged in with a positive count.</p>
        </div>
      )}
      
      {showWarning && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">Warning: Counter is negative!</p>
        </div>
      )}

      {!showWelcome && !showWarning && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-gray-600">Try logging in and incrementing the counter.</p>
        </div>
      )}

      <p className="text-sm text-gray-500">
        Conditions: <code className="bg-gray-100 px-1 rounded text-xs">$page.isLoggedIn && $page.counter {'>'} 0</code>
      </p>
    </div>
  )
}

const VariableOverview: React.FC = () => {
  const [counter] = useVariable<number>('page', 'counter')
  const [userName] = useVariable<string>('page', 'userName')
  const [isLoggedIn] = useVariable<boolean>('page', 'isLoggedIn')
  const [theme] = useVariable<string>('global', 'theme')

  const variables = [
    { path: '$page.counter', value: counter, type: 'number' },
    { path: '$page.userName', value: userName, type: 'string' },
    { path: '$page.isLoggedIn', value: isLoggedIn, type: 'boolean' },
    { path: '$global.theme', value: theme, type: 'string (persisted)' },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-4 font-medium text-gray-700">Variable Path</th>
            <th className="text-left py-2 px-4 font-medium text-gray-700">Current Value</th>
            <th className="text-left py-2 px-4 font-medium text-gray-700">Type</th>
          </tr>
        </thead>
        <tbody>
          {variables.map(v => (
            <tr key={v.path} className="border-b border-gray-100">
              <td className="py-2 px-4">
                <code className="text-blue-600">{v.path}</code>
              </td>
              <td className="py-2 px-4">
                <code className="bg-gray-100 px-2 py-0.5 rounded">
                  {JSON.stringify(v.value)}
                </code>
              </td>
              <td className="py-2 px-4 text-gray-500">{v.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataBindingDemo
