/** Common LaTeX symbols: command, the character it prints, a name, its group and any package it needs. */
export interface LatexSymbol {
  cmd: string;
  char: string;
  name: string;
  group: string;
  pkg?: string;
  math: boolean;
}

const RAW = `
Greek|\\alpha α alpha;\\beta β beta;\\gamma γ gamma;\\delta δ delta;\\epsilon ϵ epsilon;\\varepsilon ε epsilon (variant);\\zeta ζ zeta;\\eta η eta;\\theta θ theta;\\vartheta ϑ theta (variant);\\iota ι iota;\\kappa κ kappa;\\lambda λ lambda;\\mu μ mu;\\nu ν nu;\\xi ξ xi;\\pi π pi;\\varpi ϖ pi (variant);\\rho ρ rho;\\varrho ϱ rho (variant);\\sigma σ sigma;\\varsigma ς final sigma;\\tau τ tau;\\upsilon υ upsilon;\\phi ϕ phi;\\varphi φ phi (variant);\\chi χ chi;\\psi ψ psi;\\omega ω omega;\\Gamma Γ Gamma (capital);\\Delta Δ Delta (capital);\\Theta Θ Theta (capital);\\Lambda Λ Lambda (capital);\\Xi Ξ Xi (capital);\\Pi Π Pi (capital);\\Sigma Σ Sigma (capital);\\Upsilon Υ Upsilon (capital);\\Phi Φ Phi (capital);\\Psi Ψ Psi (capital);\\Omega Ω Omega (capital)
Relations|= = equals;\\neq ≠ not equal;< < less than;> > greater than;\\leq ≤ less than or equal;\\geq ≥ greater than or equal;\\ll ≪ much less than;\\gg ≫ much greater than;\\approx ≈ approximately equal;\\sim ∼ similar to;\\simeq ≃ asymptotically equal;\\cong ≅ congruent;\\equiv ≡ equivalent / identical;\\propto ∝ proportional to;\\prec ≺ precedes;\\succ ≻ succeeds;\\preceq ⪯ precedes or equal;\\succeq ⪰ succeeds or equal;\\perp ⊥ perpendicular;\\parallel ∥ parallel;\\mid ∣ divides;\\nmid ∤ does not divide @amssymb;\\models ⊨ models;\\vdash ⊢ proves;\\doteq ≐ approaches the limit;\\coloneqq ≔ defined as @mathtools;\\leqslant ⩽ less or equal (slanted) @amssymb;\\geqslant ⩾ greater or equal (slanted) @amssymb
Operators|+ + plus;- − minus;\\pm ± plus or minus;\\mp ∓ minus or plus;\\times × times;\\div ÷ divide;\\cdot ⋅ dot product;\\ast ∗ asterisk;\\star ⋆ star;\\circ ∘ composition;\\bullet ∙ bullet;\\oplus ⊕ direct sum / xor;\\ominus ⊖ circled minus;\\otimes ⊗ tensor product;\\odot ⊙ circled dot;\\wedge ∧ logical and;\\vee ∨ logical or;\\cap ∩ intersection;\\cup ∪ union;\\setminus ∖ set difference;\\sqrt{x} √ square root;\\sqrt[n]{x} ∛ nth root;\\frac{a}{b} ½ fraction;\\nabla ∇ nabla / del;\\partial ∂ partial derivative;\\dagger † dagger
Big operators|\\sum ∑ sum;\\prod ∏ product;\\coprod ∐ coproduct;\\int ∫ integral;\\iint ∬ double integral @amsmath;\\iiint ∭ triple integral @amsmath;\\oint ∮ contour integral;\\bigcup ⋃ big union;\\bigcap ⋂ big intersection;\\bigoplus ⨁ big direct sum;\\bigotimes ⨂ big tensor product;\\bigvee ⋁ big or;\\bigwedge ⋀ big and;\\lim lim limit;\\max max maximum;\\min min minimum;\\sup sup supremum;\\inf inf infimum
Arrows|\\to → to / right arrow;\\rightarrow → right arrow;\\leftarrow ← left arrow;\\leftrightarrow ↔ left-right arrow;\\Rightarrow ⇒ implies;\\Leftarrow ⇐ is implied by;\\Leftrightarrow ⇔ if and only if;\\iff ⟺ if and only if (long);\\implies ⟹ implies (long) @amsmath;\\mapsto ↦ maps to;\\longrightarrow ⟶ long right arrow;\\uparrow ↑ up arrow;\\downarrow ↓ down arrow;\\updownarrow ↕ up-down arrow;\\nearrow ↗ north-east arrow;\\searrow ↘ south-east arrow;\\hookrightarrow ↪ hook arrow (injection);\\rightleftharpoons ⇌ equilibrium;\\xrightarrow{f} ⟶ arrow with label @amsmath
Sets & logic|\\in ∈ element of;\\notin ∉ not an element of;\\ni ∋ contains as member;\\subset ⊂ subset;\\subseteq ⊆ subset or equal;\\supset ⊃ superset;\\supseteq ⊇ superset or equal;\\emptyset ∅ empty set;\\varnothing ⌀ empty set (variant) @amssymb;\\forall ∀ for all;\\exists ∃ there exists;\\nexists ∄ there does not exist @amssymb;\\neg ¬ not;\\land ∧ and;\\lor ∨ or;\\therefore ∴ therefore @amssymb;\\because ∵ because @amssymb;\\top ⊤ true / top;\\bot ⊥ false / bottom;\\mathbb{N} ℕ natural numbers @amssymb;\\mathbb{Z} ℤ integers @amssymb;\\mathbb{Q} ℚ rationals @amssymb;\\mathbb{R} ℝ real numbers @amssymb;\\mathbb{C} ℂ complex numbers @amssymb
Misc math|\\infty ∞ infinity;\\aleph ℵ aleph;\\hbar ℏ h-bar (Planck);\\ell ℓ script l;\\Re ℜ real part;\\Im ℑ imaginary part;\\wp ℘ Weierstrass p;\\angle ∠ angle;\\triangle △ triangle;\\square □ square @amssymb;\\checkmark ✓ check mark @amssymb;\\degree ° degree @gensymb;^\\circ ° degree (math);\\prime ′ prime;\\ldots … dots (baseline);\\cdots ⋯ dots (centred);\\vdots ⋮ vertical dots;\\ddots ⋱ diagonal dots;\\langle ⟨ left angle bracket;\\rangle ⟩ right angle bracket;\\lfloor ⌊ left floor;\\rfloor ⌋ right floor;\\lceil ⌈ left ceiling;\\rceil ⌉ right ceiling;\\| ‖ norm
Accents|\\hat{a} â hat;\\bar{a} ā bar;\\vec{a} a⃗ vector arrow;\\dot{a} ȧ dot (derivative);\\ddot{a} ä double dot;\\tilde{a} ã tilde;\\acute{a} á acute;\\grave{a} à grave;\\breve{a} ă breve;\\check{a} ǎ check;\\overline{AB} AB̅ overline;\\widehat{AB} ÂB wide hat
Text|\\textbackslash \\ backslash (text);\\& & ampersand;\\% % percent;\\$ $ dollar;\\# # hash;\\_ _ underscore;\\{ { left brace;\\} } right brace;\\textasciitilde ~ tilde (text);\\textasciicircum ^ caret (text);\\S § section sign;\\P ¶ paragraph sign;\\dag † dagger (text);\\ddag ‡ double dagger (text);\\copyright © copyright;\\textregistered ® registered;\\texttrademark ™ trademark;\\pounds £ pound sign;\\euro € euro @eurosym;\\textdegree ° degree (text) @textcomp;\\textbullet • bullet (text);\\textellipsis … ellipsis (text);-- – en dash;--- — em dash;\`\` “ opening double quote;'' ” closing double quote;~ (nbsp) non-breaking space;\\, (thin) thin space;\\quad (1em) em space
`;

export const SYMBOLS: LatexSymbol[] = RAW.trim()
  .split('\n')
  .flatMap((line) => {
    const bar = line.indexOf('|');
    const group = line.slice(0, bar);
    const rest = line.slice(bar + 1);
    return rest.split(';').map((item) => {
      const pkgMatch = /\s@([\w-]+)$/.exec(item);
      const body = pkgMatch ? item.slice(0, pkgMatch.index) : item;
      const [cmd, char, ...name] = body.trim().split(' ');
      return { cmd, char, name: name.join(' '), group, pkg: pkgMatch?.[1], math: !['Text'].includes(group) };
    });
  });

export const SYMBOL_GROUPS = [...new Set(SYMBOLS.map((s) => s.group))];
