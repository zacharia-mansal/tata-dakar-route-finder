// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { listStops, submitRun } = vi.hoisted(() => ({
  listStops: vi.fn(),
  submitRun: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: unknown }) => options,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

vi.mock('../components/yoonu', () => ({
  BottomNav: () => null,
  FigmaIcon: () => null,
  Phone: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../lib/actions', () => ({
  useAction: () => ({ pending: false, uncertain: false, error: null, run: submitRun, clearError: vi.fn() }),
}))

vi.mock('../server/transit', () => ({ listContributionTransitStops: listStops }))
vi.mock('../server/yoonu', () => ({ submitContribution: vi.fn() }))

import { Contribuer } from './contribuer'

describe('Contribuer screen', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    listStops.mockReset()
    submitRun.mockReset()
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('shows a loading state before rendering the empty state', async () => {
    let resolveStops!: (value: unknown) => void
    listStops.mockReturnValue(new Promise((resolve) => { resolveStops = resolve }))

    await act(async () => root.render(<Contribuer />))
    expect(container.textContent).toContain('Chargement des arrêts')
    expect(listStops).toHaveBeenCalledWith({ data: { network: 'aftu_dakar' } })

    await act(async () => resolveStops({ ok: true, data: { network: 'aftu_dakar', stops: [] } }))
    expect(container.textContent).toContain('Aucun arrêt incomplet disponible')
  })

  it('shows a load error and retries the selected network', async () => {
    listStops
      .mockResolvedValueOnce({ ok: false, code: 'service_unavailable', message: 'Service indisponible.' })
      .mockResolvedValueOnce({ ok: true, data: { network: 'aftu_dakar', stops: [] } })

    await act(async () => root.render(<Contribuer />))
    expect(container.textContent).toContain('Service indisponible.')

    const retry = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Réessayer')
    expect(retry).toBeDefined()
    await act(async () => retry?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(listStops).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('Aucun arrêt incomplet disponible')
  })

  it('submits a proposal attached to the selected incomplete stop', async () => {
    listStops.mockResolvedValue({
      ok: true,
      data: {
        network: 'aftu_dakar',
        stops: [{ id: 'FICTIF-stop-1', name: null, network: 'aftu_dakar', qualityStatus: 'incomplete' }],
      },
    })

    await act(async () => root.render(<Contribuer />))
    const input = container.querySelector<HTMLInputElement>('#proposed-stop-label')
    const form = container.querySelector('form')
    expect(input).not.toBeNull()
    expect(form).not.toBeNull()

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'FICTIF-repère connu')
      input!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))

    expect(submitRun).toHaveBeenCalledWith({ data: {
      name: 'FICTIF-repère connu',
      type: 'incomplete_stop_reference',
      lineName: 'aftu_dakar',
      message: 'Arrêt FICTIF-stop-1 — repère proposé : FICTIF-repère connu',
    } })
  })
})
