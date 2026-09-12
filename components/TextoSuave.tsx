import { useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, TextStyle } from 'react-native';

/**
 * Texto que troca com crossfade em vez de trocar de uma vez.
 *
 * Existe por causa do Copiloto: o card abre com a frase determinística e, num
 * cache frio, recebe a versão redigida um segundo depois. Trocar direto lê como
 * defeito — parece que a tela piscou. Com o fade curto, lê como conteúdo que
 * terminou de carregar.
 *
 * Só anima quando o texto realmente muda; a primeira renderização é imediata.
 */
type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  /** Duração de cada metade do crossfade, em ms. */
  duracao?: number;
};

export function TextoSuave({ children, style, duracao = 160 }: Props) {
  const [exibido, setExibido] = useState(children);
  const opacidade = useRef(new Animated.Value(1)).current;
  const primeiraVez = useRef(true);

  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false;
      setExibido(children);
      return;
    }
    if (children === exibido) return;

    let vivo = true;
    Animated.timing(opacidade, {
      toValue: 0,
      duration: duracao,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || !vivo) return;
      setExibido(children);
      Animated.timing(opacidade, {
        toValue: 1,
        duration: duracao,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      vivo = false;
    };
    // `exibido` fora das dependências de propósito: ele é o alvo da troca,
    // incluí-lo reiniciaria a animação no meio dela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, duracao, opacidade]);

  return (
    <Animated.Text style={[style, { opacity: opacidade }]}>{exibido}</Animated.Text>
  );
}
