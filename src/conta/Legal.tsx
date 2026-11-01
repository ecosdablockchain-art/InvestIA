import type { ReactNode } from 'react'
import { Tela } from '../ui/componentes'

const RESPONSAVEL = '[NOME DO RESPONSÁVEL / EMPRESA E CNPJ]'
const CONTATO = '[E-MAIL DE CONTATO]'

function Pagina({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Tela titulo={titulo} voltar={{ rotulo: 'Voltar', href: '#/' }}>
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        Rascunho — revisar com um advogado e preencher os campos entre colchetes antes de divulgar o app.
      </p>
      <article className="space-y-3 rounded-2xl bg-white p-5 text-[0.95rem] leading-relaxed ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro [&_h2]:mt-4 [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </article>
    </Tela>
  )
}

export function Privacidade() {
  return (
    <Pagina titulo="Privacidade">
      <p>Versão de novembro de 2026. Responsável pelo tratamento dos dados: {RESPONSAVEL}. Contato: {CONTATO}.</p>
      <h2>Que dados guardamos</h2>
      <ul>
        <li>Seu e-mail e a senha (guardada só em forma criptografada pelo serviço de login).</li>
        <li>Os dados financeiros que você digita ou importa: lançamentos, categorias, contas, cartões, dívidas, investimentos e metas.</li>
        <li>Não guardamos número de cartão, CVV, senhas de banco nem senhas de PDF. Arquivos importados (extratos, faturas, imagens) são lidos no seu aparelho e descartados; só os lançamentos que você confirma são salvos.</li>
      </ul>
      <h2>Para que usamos</h2>
      <p>Somente para mostrar suas finanças para você, em qualquer aparelho em que você entrar. Não vendemos, não compartilhamos para publicidade e não usamos seus dados financeiros para outros fins.</p>
      <h2>Onde ficam</h2>
      <p>Na sua conta, num banco de dados hospedado pelo Supabase, com regras que impedem qualquer outro usuário de acessá-los, e em cópia no seu aparelho para funcionar sem internet. A leitura de imagens (OCR) acontece no seu aparelho.</p>
      <h2>Seus direitos (LGPD)</h2>
      <ul>
        <li>Acessar e baixar seus dados a qualquer momento: Ajustes › Exportar backup.</li>
        <li>Corrigir ou apagar qualquer informação dentro do app.</li>
        <li>Excluir a conta e todos os dados: Ajustes › Excluir minha conta. A exclusão é imediata e definitiva.</li>
        <li>Tirar dúvidas ou fazer pedidos pelo contato acima.</li>
      </ul>
      <h2>Base legal</h2>
      <p>Execução do serviço que você contratou ao criar a conta (art. 7º, V, da LGPD) e seu consentimento, registrado na criação da conta.</p>
    </Pagina>
  )
}

export function Termos() {
  return (
    <Pagina titulo="Termos de uso">
      <p>Versão de novembro de 2026. Serviço oferecido por {RESPONSAVEL}.</p>
      <h2>O que é o Finanças 360</h2>
      <p>Uma ferramenta para você organizar e acompanhar suas finanças pessoais e dos seus negócios. Os cálculos, previsões e alertas são estimativas baseadas nos dados que você informa.</p>
      <h2>O que não é</h2>
      <p>O Finanças 360 não é banco, corretora nem consultoria. Não recomenda investimentos específicos e não substitui um planejador financeiro, contador ou assessor de investimentos registrado na CVM.</p>
      <h2>Sua conta</h2>
      <ul>
        <li>Você é responsável por manter sua senha em segredo e pelos dados que cadastra.</li>
        <li>Use o serviço apenas para fins lícitos e com dados seus ou que você tenha autorização para registrar.</li>
        <li>Você pode excluir a conta a qualquer momento em Ajustes.</li>
      </ul>
      <h2>Disponibilidade</h2>
      <p>Fazemos o possível para manter o serviço no ar e seus dados seguros, mas recomendamos exportar um backup de vez em quando. Podemos atualizar estes termos; mudanças importantes serão avisadas no app.</p>
      <h2>Contato</h2>
      <p>{CONTATO}</p>
    </Pagina>
  )
}
