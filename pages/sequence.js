import { useMemo } from 'react'
import Header from '../components/Header'
import RichText from '../components/RichText'
import Seo from '../components/Seo'
import { useTranslations } from '../lib/i18n'

// Step IDs in order
const STEP_IDS = [
  'seq_01_setup',
  'seq_02_roster',
  'seq_03_deploy',
  'seq_04_initiative',
  'seq_05_strategy'
]

function processSequenceText(text) {
  if (!text || typeof text !== 'string') return text
  
  // Replace "kill team" (case-insensitive, but preserve original case) with link
  text = text.replace(/\b(kill team)\b/gi, (match) => {
    return `[${match}](/killteams)`
  })
  
  // Replace "killzone" (case-insensitive) with link to Maps tab
  text = text.replace(/\b(killzone)\b/gi, (match) => {
    return `[${match}](/ops#ops-maps)`
  })
  
  // Replace "crit op" (case-insensitive) with link to Crit Ops tab
  text = text.replace(/\b(crit op)\b/gi, (match) => {
    return `[${match}](/ops#ops-critical)`
  })
  
  return text
}

export default function Sequence(){
  const t = useTranslations('sequence')
  const tCommon = useTranslations('common')
  
  const steps = useMemo(() => {
    return STEP_IDS.map(stepId => {
      const title = t(`steps.${stepId}.title`)
      const body = t(`steps.${stepId}.body`)
      return {
        id: stepId,
        title: title || '',
        body: body || ''
      }
    }).filter(step => step.title && step.body)
  }, [t])

  return (
    <>
      <Seo
        title={t('title')}
        description={t('description')}
      />
      <div className="container">
        <Header />
        <div className="card">
          <h2 style={{marginTop:0}}>{t('title')}</h2>
          {steps.length===0 && <div className="muted">{t('noSteps')}</div>}
          {steps.length > 0 && (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {steps.map((s, index)=> {
              const iconSequence = ['⚡', '♟', '🔥', '🕒', '🏆', '🔚']
              const icon = iconSequence[index] || '●'
              return (
                <li
                  key={s.id}
                  style={{
                    marginBottom: '.6rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.4rem'
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'var(--muted)',
                      minWidth: '2rem',
                      textAlign: 'right'
                    }}
                  >
                    {`${index + 1}.`}
                  </span>
                  <span
                    aria-hidden="true"
                    role="img"
                    style={{
                      fontSize: '1.1rem'
                    }}
                  >
                    {icon}
                  </span>
                  <div style={{ marginLeft: '0.25rem', flex: 1 }}>
                    <strong>{s.title}</strong>
                    <RichText className="muted" text={processSequenceText(s.body)} />
                  </div>
                </li>
              )
            })}
          </ol>
          )}
        </div>
      </div>
    </>
  )
}
