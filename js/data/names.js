// Namnlistor för slumpade politiker, journalister och partimedlemmar.
export const FIRST_F = ['Anna', 'Maria', 'Karin', 'Eva', 'Sara', 'Lena', 'Emma', 'Johanna', 'Malin', 'Ulrika', 'Annika', 'Jenny', 'Linda', 'Sofia', 'Elin', 'Åsa', 'Helena', 'Ida', 'Hanna', 'Camilla', 'Therese', 'Petra', 'Ebba', 'Nooshi', 'Amineh', 'Leila', 'Fatima', 'Aida', 'Maja', 'Matilda', 'Agnes', 'Alice', 'Ellen', 'Tove', 'Frida', 'Gunilla', 'Birgitta', 'Margareta', 'Ingrid', 'Cecilia', 'Rebecka', 'Jessica', 'Nina', 'Lovisa', 'Klara', 'Stina', 'Moa', 'Alva', 'Nadia', 'Yasmin'];
export const FIRST_M = ['Johan', 'Anders', 'Erik', 'Lars', 'Karl', 'Per', 'Magnus', 'Fredrik', 'Mikael', 'Daniel', 'Jonas', 'Mattias', 'Henrik', 'Niklas', 'Martin', 'Andreas', 'Oscar', 'Gustav', 'Axel', 'Tobias', 'Jimmie', 'Ulf', 'Stefan', 'Jakob', 'Emil', 'Simon', 'Hampus', 'Viktor', 'Filip', 'Adam', 'Ali', 'Omar', 'Hassan', 'Mehmet', 'Samir', 'Amir', 'Göran', 'Bengt', 'Björn', 'Sven', 'Tommy', 'Rickard', 'Christer', 'Kenneth', 'Robert', 'Marcus', 'Patrik', 'Nils', 'Arvid', 'Elias'];
export const LAST = ['Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson', 'Svensson', 'Gustafsson', 'Pettersson', 'Jonsson', 'Jansson', 'Hansson', 'Bengtsson', 'Lindberg', 'Lindqvist', 'Lindgren', 'Berg', 'Axelsson', 'Bergström', 'Lundberg', 'Lind', 'Lundgren', 'Lundqvist', 'Mattsson', 'Berglund', 'Fredriksson', 'Sandberg', 'Henriksson', 'Forsberg', 'Sjöberg', 'Wallin', 'Engström', 'Eklund', 'Danielsson', 'Håkansson', 'Lundin', 'Gunnarsson', 'Bergman', 'Holm', 'Samuelsson', 'Fransson', 'Nyström', 'Holmberg', 'Arvidsson', 'Löfgren', 'Söderberg', 'Nyberg', 'Blomqvist', 'Claesson', 'Nordström', 'Mårtensson', 'Lundström', 'Viklund', 'Björk', 'Bergqvist', 'Ekström', 'Norberg', 'Hedlund', 'Strömberg', 'Åberg', 'Hellström', 'Al-Sayed', 'Hussein', 'Ahmed', 'Mohammed', 'Ibrahim', 'Yilmaz', 'Kaya', 'Nguyen', 'Ekberg', 'Rosén', 'Wahlström', 'Thorén', 'Ljungberg', 'Dahl', 'Hägg', 'Öberg', 'Sundström', 'Westerberg'];
export const CITIES = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping', 'Lund', 'Umeå', 'Gävle', 'Borås', 'Södertälje', 'Eskilstuna', 'Halmstad', 'Växjö', 'Karlstad', 'Sundsvall', 'Luleå', 'Trollhättan', 'Östersund', 'Borlänge', 'Falun', 'Skellefteå', 'Kalmar', 'Kristianstad', 'Karlskrona', 'Visby', 'Nyköping', 'Varberg', 'Kiruna', 'Ystad', 'Lidköping', 'Piteå', 'Motala', 'Sandviken', 'Örnsköldsvik', 'Landskrona'];
export const EDUCATIONS = ['Statsvetare', 'Jurist', 'Ekonom', 'Civilingenjör', 'Lärare', 'Sjuksköterska', 'Läkare', 'Journalist', 'Socionom', 'Gymnasieutbildad', 'Yrkesutbildad', 'Historiker', 'Filosof', 'Officer', 'Agronom', 'Arkitekt', 'Systemvetare', 'Nationalekonom'];
export const JOBS = ['Kommunalråd', 'Fackombudsman', 'Egenföretagare', 'Advokat', 'Lärare', 'Undersköterska', 'Polis', 'Officer', 'Journalist', 'Lantbrukare', 'Ingenjör', 'Ekonomichef', 'Läkare', 'Forskare', 'Influerare', 'Bussförare', 'Industriarbetare', 'Rektor', 'Ambassadör', 'Entreprenör', 'Präst', 'Programmerare', 'Restaurangägare', 'Lokalpolitiker', 'Konsult'];
export const FAMILY = ['Arbetarklass', 'Medelklass', 'Akademikerhem', 'Företagarfamilj', 'Lantbrukarfamilj', 'Politikerfamilj', 'Invandrarfamilj', 'Överklass'];
export const JOURNALISTS = [
  { name: 'Lena Ahlqvist', outlet: 'svt', style: 'skarp' }, { name: 'Johan Rydell', outlet: 'svt', style: 'lugn' },
  { name: 'Malin Sjöstrand', outlet: 'aftonbladet', style: 'provocerande' }, { name: 'Oskar Lindell', outlet: 'expressen', style: 'skarp' },
  { name: 'Hanna Berglöf', outlet: 'dn', style: 'analytisk' }, { name: 'Fredrik Norén', outlet: 'svd', style: 'analytisk' },
  { name: 'Sara Ek', outlet: 'tv4', style: 'snabb' }, { name: 'Jakob Weiss', outlet: 'ekot', style: 'lugn' },
  { name: 'Amanda Khalil', outlet: 'aftonbladet', style: 'skarp' }, { name: 'Peter Holmén', outlet: 'tv4', style: 'provocerande' },
];
export const MEDIA = {
  svt: { name: 'SVT Nyheter', short: 'SVT', color: '#1d1d1b', fg: '#fff', lean: 0, reach: 1.4 },
  aftonbladet: { name: 'Aftonbladet', short: 'AB', color: '#ffd700', fg: '#111', lean: -.3, reach: 1.5 },
  expressen: { name: 'Expressen', short: 'EXP', color: '#0a2a8f', fg: '#fff', lean: .2, reach: 1.3 },
  dn: { name: 'Dagens Nyheter', short: 'DN', color: '#1a1a1a', fg: '#fff', lean: .1, reach: 1.1 },
  svd: { name: 'Svenska Dagbladet', short: 'SvD', color: '#2b2b2b', fg: '#fff', lean: .35, reach: .9 },
  tv4: { name: 'TV4 Nyheterna', short: 'TV4', color: '#e3000f', fg: '#fff', lean: 0, reach: 1.2 },
  ekot: { name: 'Sveriges Radio Ekot', short: 'SR', color: '#2a2a2a', fg: '#fff', lean: 0, reach: 1.0 },
  gp: { name: 'Göteborgs-Posten', short: 'GP', color: '#004b87', fg: '#fff', lean: .1, reach: .6 },
  sydsvenskan: { name: 'Sydsvenskan', short: 'SDS', color: '#003f7d', fg: '#fff', lean: .1, reach: .5 },
  nsd: { name: 'Norrländska Socialdemokraten', short: 'NSD', color: '#c00', fg: '#fff', lean: -.4, reach: .3 },
  flashback: { name: 'Sociala medier', short: 'SoMe', color: '#444', fg: '#fff', lean: 0, reach: 1.0 },
};
export const POLL_INSTITUTES = ['Novus', 'Verian', 'Demoskop', 'Ipsos', 'Indikator'];
