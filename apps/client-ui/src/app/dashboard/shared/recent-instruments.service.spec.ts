import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from '../../core/auth/token-storage.service';
import { RecentInstrumentsService } from './recent-instruments.service';

const KEY = 'ts.recent-instruments';

describe('RecentInstrumentsService', () => {
  function create(): RecentInstrumentsService {
    TestBed.resetTestingModule();
    return TestBed.inject(RecentInstrumentsService);
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts empty', () => {
    expect(create().symbols()).toEqual([]);
  });

  it('records the newest symbol first without duplicates', () => {
    const service = create();
    service.record('AAPL');
    service.record('MSFT');
    service.record('AAPL');
    expect(service.symbols()).toEqual(['AAPL', 'MSFT']);
  });

  it('keeps only the latest five', () => {
    const service = create();
    for (const symbol of ['A', 'B', 'C', 'D', 'E', 'F']) service.record(symbol);
    expect(service.symbols()).toEqual(['F', 'E', 'D', 'C', 'B']);
  });

  it('survives a reload within the tab', () => {
    create().record('NVDA');
    expect(create().symbols()).toEqual(['NVDA']);
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual(['NVDA']);
  });

  it('ignores stored values that are not a list of symbols', () => {
    sessionStorage.setItem(KEY, 'not json');
    expect(create().symbols()).toEqual([]);
    sessionStorage.setItem(KEY, '{"a":1}');
    expect(create().symbols()).toEqual([]);
    sessionStorage.setItem(KEY, JSON.stringify(['AAPL', 7, null, 'MSFT']));
    expect(create().symbols()).toEqual(['AAPL', 'MSFT']);
  });

  it('forgets everything when the signed-in user changes', () => {
    TestBed.resetTestingModule();
    const spy = vi.spyOn(TokenStorageService.prototype, 'onIdentityChange');
    const service = TestBed.inject(RecentInstrumentsService);
    service.record('AAPL');

    spy.mock.calls[0][0]();

    expect(service.symbols()).toEqual([]);
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual([]);
  });

  it('still works when storage refuses reads and writes', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = create();
    expect(service.symbols()).toEqual([]);
    service.record('AAPL');
    expect(service.symbols()).toEqual(['AAPL']);
  });
});
