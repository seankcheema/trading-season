import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent, RouterTestingModule],
    }).compileComponents();
  });

  it('should create the register component', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should render the component without errors', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
