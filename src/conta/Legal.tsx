import type { ReactNode } from 'react'
import { Tela } from '../ui/componentes'

const RESPONSAVEL = 'Rafael Martins Mendes'
const CONTATO = 'ecosdablockchain@gmail.com'
const VERSAO = '3 de novembro de 2026'

function Pagina({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Tela titulo={titulo} voltar={{ rotulo: 'Voltar', href: '#/' }}>
      <article className="space-y-3 rounded-2xl bg-white p-5 text-[0.95rem] leading-relaxed ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro [&_a]:underline [&_h2]:mt-5 [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </article>
    </Tela>
  )
}

const Email = () => <a href={`mailto:${CONTATO}`}>{CONTATO}</a>

export function Privacidade() {
  return (
    <Pagina titulo="Privacidade">
      <p>Versão de {VERSAO}.</p>
      <p>
        Esta política explica quais dados o Finanças 360 trata, para quê e quais são os seus direitos,
        conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).
      </p>

      <h2>Quem é o responsável</h2>
      <p>
        O controlador dos dados é {RESPONSAVEL}, pessoa física, que também atua como encarregado pelo tratamento
        de dados pessoais. Contato para qualquer assunto de privacidade: <Email />.
      </p>

      <h2>Que dados tratamos</h2>
      <ul>
        <li><strong>Conta:</strong> seu e-mail e sua senha. A senha é guardada pelo serviço de login apenas em forma criptografada; ninguém consegue lê-la.</li>
        <li><strong>Dados financeiros que você digita:</strong> lançamentos, categorias, contas, cartões e faturas, dívidas, investimentos, patrimônio, metas e preferências.</li>
        <li><strong>Chaves de serviços que você cadastra</strong> (cotações e Claude): ficam na sua conta para valer em todos os seus aparelhos. Não entram no backup exportado.</li>
        <li><strong>Notificações, se você ativar:</strong> o endereço técnico de entrega do seu aparelho e a agenda de avisos (por exemplo, “Fatura vence em 3 dias”, com o valor).</li>
        <li><strong>Dados técnicos de acesso</strong> (como endereço IP e data e hora), registrados automaticamente pelos provedores de hospedagem.</li>
      </ul>
      <p>Não pedimos nem guardamos número de cartão, CVV, senhas de banco ou documentos.</p>

      <h2>Para que usamos</h2>
      <ul>
        <li>Criar e proteger sua conta e confirmar seu e-mail.</li>
        <li>Mostrar suas finanças em qualquer aparelho em que você entrar e mantê-los sincronizados.</li>
        <li>Enviar os avisos que você ativou.</li>
        <li>Responder aos seus pedidos e cumprir obrigações legais.</li>
      </ul>
      <p>Não vendemos seus dados, não os usamos para publicidade e não traçamos perfil seu para terceiros.</p>

      <h2>Bases legais</h2>
      <p>
        Execução do contrato que você aceita ao criar a conta (art. 7º, V, da LGPD), cumprimento de obrigação legal (art. 7º, II)
        e, para os recursos opcionais (Consultor, cotações e notificações), o seu consentimento ao ativá-los (art. 7º, I),
        que pode ser retirado a qualquer momento desligando o recurso.
      </p>

      <h2>Com quem os dados são compartilhados</h2>
      <p>Somente com os serviços necessários para o app funcionar:</p>
      <ul>
        <li><strong>Supabase:</strong> banco de dados e login. Guarda sua conta e seus dados, com regras que impedem qualquer outro usuário de acessá-los.</li>
        <li><strong>GitHub Pages:</strong> hospeda o site do app.</li>
        <li><strong>Google (Gmail):</strong> envia os e-mails de confirmação de conta e troca de senha.</li>
        <li><strong>Cloudflare (Turnstile):</strong> verificação anti-robô ao entrar, criar conta ou trocar senha. Analisa sinais técnicos do navegador, como endereço IP, só para diferenciar pessoas de robôs.</li>
        <li><strong>Serviços de notificação</strong> da Apple, do Google ou do navegador que você usa: entregam os avisos. O conteúdo vai criptografado.</li>
        <li><strong>brapi.dev ou Alpha Vantage</strong> (se você usar cotações): recebem apenas os códigos dos ativos, como PETR4, e a sua chave. Nenhuma quantidade nem valor seu.</li>
        <li>
          <strong>Anthropic</strong> (se você usar o Consultor, com a sua própria chave): recebe um resumo com totais por mês e por categoria,
          dívidas, investimentos e metas, além das perguntas que você fizer. O resumo não leva descrições de lançamentos, nomes de
          estabelecimentos, bancos ou números de conta. Esse uso segue também os termos da Anthropic na sua conta.
        </li>
      </ul>
      <p>
        Alguns desses provedores podem processar dados fora do Brasil. Nesses casos, a transferência ocorre para a execução do
        serviço que você pediu e com provedores que adotam medidas de segurança compatíveis com a LGPD (art. 33).
      </p>

      <h2>Onde ficam e por quanto tempo</h2>
      <ul>
        <li>Na sua conta, enquanto ela existir, e em cópia no seu aparelho para o app funcionar sem internet. Ao sair da conta, a cópia do aparelho é apagada.</li>
        <li>Avisos já enviados são apagados depois de 60 dias.</li>
        <li>Ao excluir a conta, todos os dados são apagados na hora. Cópias de segurança técnicas dos provedores podem levar alguns dias para serem eliminadas.</li>
      </ul>

      <h2>Segurança</h2>
      <p>
        Conexão sempre criptografada (HTTPS), senha guardada só em forma criptografada, regras no banco que isolam os dados de cada pessoa
        e bloqueio opcional do app com Face ID ou digital. Nenhum sistema é 100% seguro; se houver um incidente relevante, você e a
        Autoridade Nacional de Proteção de Dados (ANPD) serão avisados.
      </p>

      <h2>Seus direitos</h2>
      <ul>
        <li>Confirmar que tratamos seus dados e acessá-los: Ajustes › Exportar backup.</li>
        <li>Corrigir ou apagar qualquer informação diretamente no app.</li>
        <li>Levar seus dados para outro serviço (portabilidade): o backup exportado é um arquivo aberto.</li>
        <li>Retirar o consentimento dos recursos opcionais, desligando-os em Ajustes.</li>
        <li>Excluir a conta e todos os dados: Ajustes › Excluir minha conta.</li>
        <li>Saber com quem compartilhamos dados (lista acima) e pedir qualquer outro direito do art. 18 da LGPD pelo e-mail <Email />. Respondemos em até 15 dias.</li>
        <li>Reclamar à ANPD (gov.br/anpd), se achar que seus direitos não foram atendidos.</li>
      </ul>

      <h2>Cookies e armazenamento no aparelho</h2>
      <p>
        O app não usa cookies de publicidade nem de rastreamento. Ele guarda no seu aparelho apenas o necessário para funcionar:
        sua sessão de login, suas preferências e a cópia dos seus dados.
      </p>

      <h2>Menores de idade</h2>
      <p>O Finanças 360 é destinado a maiores de 18 anos.</p>

      <h2>Mudanças nesta política</h2>
      <p>Se esta política mudar de forma importante, avisaremos no app antes de a mudança valer.</p>
    </Pagina>
  )
}

export function Termos() {
  return (
    <Pagina titulo="Termos de uso">
      <p>Versão de {VERSAO}.</p>
      <p>
        Estes termos valem entre você e {RESPONSAVEL} (contato: <Email />), responsável pelo Finanças 360.
        Ao criar uma conta, você declara que leu e concorda com eles e com a Política de Privacidade.
      </p>

      <h2>O que é o Finanças 360</h2>
      <p>
        Uma ferramenta gratuita para você organizar e acompanhar suas finanças pessoais e dos seus negócios. Os cálculos,
        previsões, alertas, simulações e pontuações são estimativas feitas a partir dos dados que você informa.
      </p>

      <h2>O que ele não é</h2>
      <p>
        O Finanças 360 não é banco, corretora, instituição de pagamento nem consultoria. Ele não movimenta dinheiro e não substitui um
        planejador financeiro, contador ou consultor de valores mobiliários registrado na CVM. Nada no app é recomendação para comprar
        ou vender um investimento específico.
      </p>

      <h2>Recursos que dependem de outros serviços</h2>
      <ul>
        <li>
          <strong>Consultor (IA Claude):</strong> as respostas são geradas por inteligência artificial e podem conter erros.
          Use-as como ponto de partida, não como decisão final. O uso é cobrado pela Anthropic na conta da chave que você cadastrar.
        </li>
        <li>
          <strong>Cotações:</strong> vêm da brapi.dev ou da Alpha Vantage, podem ter atraso ou falhas e não servem como referência
          para operar na bolsa. Os limites e custos são os do plano que você tiver nesses serviços.
        </li>
        <li><strong>Notificações:</strong> dependem do aparelho, do navegador e da internet e podem atrasar ou não chegar. Não dependa só delas para pagar contas em dia.</li>
      </ul>

      <h2>Sua conta</h2>
      <ul>
        <li>Você precisa ter 18 anos ou mais.</li>
        <li>Mantenha sua senha em segredo; você é responsável pelo que for feito com ela.</li>
        <li>Cadastre apenas dados seus ou que você tenha autorização para registrar, e use o serviço só para fins lícitos.</li>
        <li>Você pode excluir a conta a qualquer momento em Ajustes. Podemos suspender contas usadas para abuso, fraude ou ataques ao serviço.</li>
      </ul>

      <h2>Disponibilidade e backup</h2>
      <p>
        Fazemos o possível para manter o serviço no ar e seus dados seguros, mas ele pode ficar fora do ar por manutenção ou por falhas
        de provedores. Recomendamos exportar um backup de vez em quando (Ajustes › Exportar backup). Se um dia o serviço for encerrado,
        avisaremos com pelo menos 30 dias de antecedência para você baixar seus dados.
      </p>

      <h2>Responsabilidade</h2>
      <p>
        Nos limites permitidos pela lei, inclusive o Código de Defesa do Consumidor, não respondemos por decisões financeiras tomadas
        com base nas estimativas do app, por dados digitados incorretamente nem por falhas de serviços de terceiros, como cotações,
        IA, notificações e provedores de internet.
      </p>

      <h2>Mudanças nestes termos</h2>
      <p>Podemos atualizar estes termos. Mudanças importantes serão avisadas no app antes de valerem.</p>

      <h2>Lei e foro</h2>
      <p>
        Estes termos seguem as leis do Brasil. Eventuais conflitos podem ser resolvidos no foro do seu domicílio.
        Antes disso, fale com a gente: <Email />.
      </p>
    </Pagina>
  )
}
