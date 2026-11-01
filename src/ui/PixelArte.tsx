/** Ícones 8×8 em pixel art, desenhados em código (sem imagens). */
const CORES: Record<string, string> = {
  y: '#f5c518', o: '#e8891d', r: '#d64545', b: '#3b82f6', d: '#1e3a8a', g: '#22c55e', h: '#15803d',
  k: '#374151', w: '#ffffff', p: '#f472b6', s: '#9ca3af', m: '#a16207',
}

const DESENHOS: Record<string, string[]> = {
  moeda: ['..yyyy..', '.yooooy.', 'yoyyyyoy', 'yoyooyoy', 'yoyooyoy', 'yoyyyyoy', '.yooooy.', '..yyyy..'],
  calendario: ['.r....r.', 'rrrrrrrr', 'wwwwwwww', 'wkwkwkww', 'wwwwwwww', 'wkwkwbbw', 'wwwwwbbw', 'wwwwwwww'],
  chama: ['...r....', '...rr...', '..rror..', '.rroorr.', '.royyor.', 'rroyyorr', '.royyor.', '..rrrr..'],
  coroa: ['........', 'y..y..y.', 'yy.yy.yy', 'yyyyyyyy', 'yryybyyy', 'yyyyyyyy', 'oooooooo', '........'],
  escudo: ['bbbbbbbb', 'bddddddb', 'bdwwwwdb', 'bdwggwdb', 'bdwggwdb', '.bdwwdb.', '..bddb..', '...bb...'],
  alvo: ['..rrrr..', '.rwwwwr.', 'rwrrrrwr', 'rwrwwrwr', 'rwrwwrwr', 'rwrrrrwr', '.rwwwwr.', '..rrrr..'],
  trofeu: ['yyyyyyyy', 'y.yyyy.y', 'y.yyyy.y', '.yyyyyy.', '..yyyy..', '...yy...', '..oooo..', '.oooooo.'],
  cofre: ['........', '..pppp..', '.pppppp.', 'ppkppppp', 'pppppppp', '.pppppp.', '.pp..pp.', '........'],
  estrela: ['...yy...', '...yy...', 'yyyyyyyy', '.yyyyyy.', '..yyyy..', '.yyyyyy.', '.yy..yy.', 'y......y'],
  cartao: ['........', 'bbbbbbbb', 'kkkkkkkk', 'bbbbbbbb', 'bbyybbbb', 'bbyybwwb', 'bbbbbbbb', '........'],
  corrente: ['ss......', 's.s.....', '.sss....', '...s....', '....s...', '....sss.', '.....s.s', '......ss'],
  grafico: ['.......g', '......gg', '.....g.g', '.g..g...', 'g.gg....', 'g.......', 'kkkkkkkk', '........'],
}

export function PixelArte({ nome, tamanho = 40, apagado = false, rotulo }: { nome: string; tamanho?: number; apagado?: boolean; rotulo: string }) {
  const linhas = DESENHOS[nome] ?? DESENHOS.estrela ?? []
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 8 8" role="img" aria-label={rotulo} shapeRendering="crispEdges"
      style={apagado ? { filter: 'grayscale(1)', opacity: 0.35 } : undefined}>
      {linhas.flatMap((linha, y) => [...linha].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={CORES[c] ?? '#000'} />)))}
    </svg>
  )
}
