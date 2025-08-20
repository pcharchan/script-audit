# Changelog
Wszystkie istotne zmiany w tym projekcie będą dokumentowane w tym pliku.

Format oparty jest na [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), a ten projekt stosuje [Semantyczne Wersjonowanie](https://semver.org/spec/v2.0.0.html).

## [2.1.0]

### Zmieniono
- Zmieniono kolor podświetlenia dla skryptów z tej samej domeny z zielonego na delikatny niebieski (`#eaf6ff`), aby uniknąć mylenia ze statusem 'OK!'

### Naprawiono
- Naprawiono priorytet podświetlania wierszy. Skrypty oznaczone jako "potencjalnie blokujące" (czerwone tło) teraz zawsze mają najwyższy priorytet, nawet jeśli pochodzą z tej samej domeny

## [2.0.0]

### Dodano
- **Interaktywny panel:** Panel można teraz dowolnie przesuwać i chwytając za jego nagłówek
- **Zmiana rozmiaru panelu:** Dodano możliwość zmiany rozmiaru okna poprzez przeciąganie jego krawędzi i rogów
- **Zmiana szerokości kolumn:** Szerokość każdej kolumny w tabeli jest teraz regulowana. Po rozszerzeniu kolumny "Źródło" wyświetlany jest pełny adres URL
- **Sortowanie danych:** Kliknięcie w nagłówek dowolnej kolumny sortuje dane rosnąco lub malejąco. Aktywna kolumna jest oznaczona ikoną
- **Kopiowanie jako CSV:** Nowy przycisk "Kopiuj CSV" umożliwia łatwe wklejenie danych do arkuszy kalkulacyjnych
- **Wizualne wyróżnienie skryptów:** Skrypty pochodzące z tej samej domeny co strona są teraz podświetlane, co ułatwia odróżnienie zasobów własnych (first-party) od zewnętrznych (third-party)

### Zmieniono
- Przeprowadzono refaktoryzację kodu w celu poprawy czytelności i ułatwienia dalszego rozwoju
- Poprawiono drobne elementy interfejsu, dodając ikony sortowania i usprawniając logikę renderowania

## [1.4.0]

### Dodano
- **Dane wydajnościowe:** Integracja z Performance API w celu wyświetlania rozmiaru (KB) i czasu ładowania (ms) skryptów
- **Identyfikacja skryptów blokujących:** Oznaczanie skryptów, które są potencjalnymi kandydatami do blokowania renderowania strony
- **Opcje zarządzania:** Możliwość globalnego włączenia/wyłączenia skryptu z menu rozszerzenia oraz przycisk "Wyłącz" w panelu
- **Kopiowanie danych:** Funkcja kopiowania zebranych danych jako JSON do schowka

## [1.0.0]

### Dodano
- **Pierwsza wersja skryptu**
- **Podstawowa funkcjonalność audytu:** Wyświetlanie listy wszystkich skryptów (`<script>`) na stronie
- **Analiza atrybutów:** Pokazywanie  atrybutów, takich jak `async`, `defer` i `type='module'`
- **Panel z interfejsem:** Przycisk "JS" do przełączania widoczności panelu z danymi
